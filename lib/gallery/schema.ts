export type SavedTuning = "just" | "equal" | "detected";
export type SavedView = "flat" | "orbit";
export type SavedPalette = "consonance";

export interface CurveParams {
  f1: number;
  f2: number;
  tuning: SavedTuning;
  decay: number;
  view: SavedView;
  palette: SavedPalette;
}

export interface CurveRecord {
  id: string;
  createdBy: string;
  title: string;
  params: CurveParams;
  createdAt: string;
}

export interface NewCurve {
  createdBy: string;
  title: string;
  params: CurveParams;
}

export const LIMITS = {
  name: 40,
  title: 60,
  minHz: 20,
  maxHz: 20_000,
  minDecay: 0.005,
  maxDecay: 0.25,
} as const;

const TUNINGS: SavedTuning[] = ["just", "equal", "detected"];
const VIEWS: SavedView[] = ["flat", "orbit"];
const PALETTES: SavedPalette[] = ["consonance"];

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return s.length >= 1 && s.length <= max ? s : null;
}

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function oneOf<T extends string>(v: unknown, options: readonly T[]): T | null {
  return options.includes(v as T) ? (v as T) : null;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateNewCurve(body: unknown): Validated<NewCurve> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Expected a JSON object." };
  const b = body as Record<string, unknown>;
  const p = (typeof b.params === "object" && b.params !== null ? b.params : {}) as Record<string, unknown>;

  const createdBy = cleanText(b.createdBy, LIMITS.name);
  if (!createdBy) return { ok: false, error: `Name must be 1–${LIMITS.name} characters.` };
  const title = cleanText(b.title, LIMITS.title);
  if (!title) return { ok: false, error: `Title must be 1–${LIMITS.title} characters.` };

  const f1 = num(p.f1, LIMITS.minHz, LIMITS.maxHz);
  const f2 = num(p.f2, LIMITS.minHz, LIMITS.maxHz);
  const decay = num(p.decay, LIMITS.minDecay, LIMITS.maxDecay);
  const tuning = oneOf(p.tuning, TUNINGS);
  const view = oneOf(p.view, VIEWS);
  const palette = oneOf(p.palette ?? "consonance", PALETTES);
  if (f1 === null || f2 === null) return { ok: false, error: "Frequencies must be 20 Hz – 20 kHz." };
  if (decay === null) return { ok: false, error: "Decay out of range." };
  if (!tuning || !view || !palette) return { ok: false, error: "Unknown tuning, view or palette." };

  return { ok: true, value: { createdBy, title, params: { f1, f2, tuning, decay, view, palette } } };
}
