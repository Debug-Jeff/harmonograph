import "server-only";
import { createHash } from "node:crypto";
import { StoreUnavailableError } from "./store";

export const SAVE_LIMIT = { max: 6, windowMs: 10 * 60 * 1000 };

export const MAX_BODY_BYTES = 2048;

export function clientHash(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const salt = process.env.RATE_LIMIT_SALT ?? "harmony";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function jsonError(status: number, error: string, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers });
}

export function storageError(err: unknown) {
  if (err instanceof StoreUnavailableError) return jsonError(503, err.message);
  console.error("[gallery]", err);
  return jsonError(503, "The gallery is unavailable right now.");
}
