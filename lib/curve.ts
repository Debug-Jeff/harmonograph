export interface HarmonicParams {
  f1: number;
  f2: number;
  phase1: number;
  phase2: number;
  decay: number;
}

export interface CurveStyle {
  complexityT: number;
  closureCycles: number | null;
  reveal: number;
}

export interface CurveRenderer {
  resize(cssW: number, cssH: number, dpr: number, insetBottom: number): void;
  clear(): void;
  drawHarmonic(params: HarmonicParams, style: CurveStyle): void;
  drawScope(samples: Float32Array, delay: number): void;
  present(): void;
  dispose(): void;
}

export const GOLD = [201, 167, 104];
export const VIOLET = [108, 92, 224];
export const GHOST = [242, 239, 230];

export const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

type Lch = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function rgbToOklch([r8, g8, b8]: number[]): Lch {
  const [r, g, b] = [r8, g8, b8].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function oklchToRgb([L, C, h]: Lch): number[] {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return rgb.map((c) => Math.round(255 * Math.min(1, Math.max(0, toSrgb(c)))));
}

const SPECTRUM_STEPS = 64;
const SPECTRUM: number[][] = (() => {
  const a = rgbToOklch(GOLD), b = rgbToOklch(VIOLET);
  let dh = b[2] - a[2];
  if (dh > Math.PI) dh -= 2 * Math.PI;
  if (dh < -Math.PI) dh += 2 * Math.PI;
  return Array.from({ length: SPECTRUM_STEPS + 1 }, (_, i) => {
    const t = i / SPECTRUM_STEPS;
    return oklchToRgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + dh * t]);
  });
})();

export const curveColor = (complexityT: number) =>
  SPECTRUM[Math.round(Math.min(1, Math.max(0, complexityT)) * SPECTRUM_STEPS)];

export const curveAlpha = (env: number) => 0.06 + 0.7 * Math.pow(env, 1.1);

const FADE_TO = 0.03;
const MAX_CYCLES = 220;

export interface CurveSpan {
  n: number;
  dt: number;
  r: number;
  decayPerRad: number;
}

export function curveSpan({ f1, f2, decay }: HarmonicParams, style: CurveStyle, maxPoints: number): CurveSpan | null {
  const r = Math.max(f1, f2) / Math.min(f1, f2);
  const d = Math.max(decay, 0.004);
  const fadeCycles = Math.log(1 / FADE_TO) / d;
  const minCycles = style.closureCycles ? style.closureCycles * 3 : 24;
  const cycles = Math.min(MAX_CYCLES, Math.max(fadeCycles, minCycles)) * style.reveal;
  if (cycles <= 0) return null;
  const perCycle = Math.min(Math.ceil(80 * Math.max(1, r)), Math.floor(maxPoints / cycles));
  return {
    n: Math.ceil(cycles * perCycle),
    dt: (2 * Math.PI) / perCycle,
    r,
    decayPerRad: d / (2 * Math.PI),
  };
}
