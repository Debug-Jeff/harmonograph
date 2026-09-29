import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import type { CurveParams, CurveRecord, NewCurve } from "./schema";

export interface CurveStore {
  list(limit: number): Promise<CurveRecord[]>;
  get(id: string): Promise<CurveRecord | null>;
  create(curve: NewCurve, clientHash: string): Promise<CurveRecord>;
  countRecent(clientHash: string, since: Date): Promise<number>;
}

export class StoreUnavailableError extends Error {}

function newId(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

interface Row {
  id: string;
  created_by: string;
  title: string;
  params: CurveParams;
  created_at: Date;
}

const toRecord = (r: Row): CurveRecord => ({
  id: r.id,
  createdBy: r.created_by,
  title: r.title,
  params: r.params,
  createdAt: r.created_at.toISOString(),
});

class PostgresStore implements CurveStore {
  private sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  private ready: Promise<unknown> | null = null;

  private ensure() {
    this.ready ??= this.sql`
      create table if not exists curves (
        id          text primary key,
        created_by  text not null,
        title       text not null,
        params      jsonb not null,
        created_at  timestamptz not null default now(),
        client_hash text not null
      )`.then(() =>
      this.sql`create index if not exists curves_client_recent on curves (client_hash, created_at desc)`,
    );
    return this.ready;
  }

  async list(limit: number) {
    await this.ensure();
    const rows = await this.sql<Row[]>`
      select id, created_by, title, params, created_at from curves
      order by created_at desc limit ${limit}`;
    return rows.map(toRecord);
  }

  async get(id: string) {
    await this.ensure();
    const rows = await this.sql<Row[]>`
      select id, created_by, title, params, created_at from curves where id = ${id}`;
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(curve: NewCurve, clientHash: string) {
    await this.ensure();
    const rows = await this.sql<Row[]>`
      insert into curves (id, created_by, title, params, client_hash)
      values (${newId()}, ${curve.createdBy}, ${curve.title}, ${this.sql.json(curve.params as never)}, ${clientHash})
      returning id, created_by, title, params, created_at`;
    return toRecord(rows[0]);
  }

  async countRecent(clientHash: string, since: Date) {
    await this.ensure();
    const [{ n }] = await this.sql<{ n: number }[]>`
      select count(*)::int as n from curves where client_hash = ${clientHash} and created_at > ${since}`;
    return n;
  }
}

type FileRow = CurveRecord & { clientHash: string };

class FileStore implements CurveStore {
  private file = path.join(process.cwd(), ".data", "curves.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<FileRow[]> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as FileRow[];
    } catch {
      return [];
    }
  }

  private mutate<T>(fn: (rows: FileRow[]) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const rows = await this.read();
      const result = fn(rows);
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(rows, null, 2));
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private strip({ clientHash: _, ...rec }: FileRow): CurveRecord {
    return rec;
  }

  async list(limit: number) {
    const rows = await this.read();
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((r) => this.strip(r));
  }

  async get(id: string) {
    const row = (await this.read()).find((r) => r.id === id);
    return row ? this.strip(row) : null;
  }

  create(curve: NewCurve, clientHash: string) {
    return this.mutate((rows) => {
      const row: FileRow = { id: newId(), ...curve, createdAt: new Date().toISOString(), clientHash };
      rows.push(row);
      return this.strip(row);
    });
  }

  async countRecent(clientHash: string, since: Date) {
    const iso = since.toISOString();
    return (await this.read()).filter((r) => r.clientHash === clientHash && r.createdAt > iso).length;
  }
}

let store: CurveStore | null = null;

export function getStore(): CurveStore {
  if (store) return store;
  if (process.env.DATABASE_URL) {
    store = new PostgresStore();
  } else if (process.env.VERCEL || process.env.NETLIFY) {
    throw new StoreUnavailableError("Gallery storage isn't configured: set DATABASE_URL.");
  } else {
    store = new FileStore();
  }
  return store;
}
