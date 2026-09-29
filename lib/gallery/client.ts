import type { Frame } from "../audio/AudioEngine";
import { TOLERANCE_CENTS } from "../ratio";
import type { CurveParams, CurveRecord, NewCurve } from "./schema";

const ORIGIN = process.env.NEXT_PUBLIC_GALLERY_ORIGIN ?? "";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORIGIN}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status}).`);
  return body as T;
}

export const listCurves = () => call<{ curves: CurveRecord[] }>("/api/curves").then((r) => r.curves);

export const getCurve = (id: string) =>
  call<{ curve: CurveRecord }>(`/api/curves/${encodeURIComponent(id)}`).then((r) => r.curve);

export const saveCurve = (curve: NewCurve) =>
  call<{ curve: CurveRecord }>("/api/curves", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(curve),
  }).then((r) => r.curve);

export const toleranceFor = (p: CurveParams) =>
  p.tuning === "detected" ? TOLERANCE_CENTS.detected : TOLERANCE_CENTS.exact;

export function frameFromParams(p: CurveParams): Frame {
  return { kind: "harmonic", f1: p.f1, f2: p.f2, tolerance: toleranceFor(p), confidence: 1 };
}

export const shareUrl = (id: string) => `${window.location.origin}/gallery?c=${encodeURIComponent(id)}`;
