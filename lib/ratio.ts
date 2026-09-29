export interface IntervalInfo {
  p: number;
  q: number;
  name: string | null;
  complexity: number;
  centsError: number;
  ratio: number;
}

export const MAX_COMPLEXITY = 100;

export const DEFAULT_BASE_TOLERANCE = 80;

export const TOLERANCE_CENTS = {
  exact: DEFAULT_BASE_TOLERANCE,
  detected: DEFAULT_BASE_TOLERANCE,
} as const;

export function cents(ratio: number): number {
  return 1200 * Math.log2(ratio);
}

export function convergents(x: number, maxTerm = MAX_COMPLEXITY): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let hPrev = 1, hPrev2 = 0;
  let kPrev = 0, kPrev2 = 1;
  let v = x;
  for (let i = 0; i < 24; i++) {
    const a = Math.floor(v);
    const h = a * hPrev + hPrev2;
    const k = a * kPrev + kPrev2;
    if (h > maxTerm || k > maxTerm) break;
    out.push([h, k]);
    const frac = v - a;
    if (frac < 1e-12) break;
    v = 1 / frac;
    hPrev2 = hPrev; hPrev = h;
    kPrev2 = kPrev; kPrev = k;
  }
  return out;
}

export function acceptsRatio(
  centsError: number,
  p: number,
  q: number,
  baseTolerance: number = DEFAULT_BASE_TOLERANCE,
): boolean {
  const complexity = p * q;
  if (complexity > MAX_COMPLEXITY) return false;
  const tolerance = baseTolerance / Math.log2(complexity + 2);
  return Math.abs(centsError) <= tolerance;
}

const BASE_NAMES: Record<string, string> = {
  "1:1": "unison",
  "16:15": "minor second",
  "9:8": "major second",
  "8:7": "septimal whole tone",
  "7:6": "septimal minor third",
  "6:5": "minor third",
  "5:4": "major third",
  "9:7": "septimal major third",
  "4:3": "perfect fourth",
  "11:8": "undecimal tritone",
  "7:5": "septimal tritone",
  "45:32": "tritone",
  "10:7": "septimal tritone",
  "3:2": "perfect fifth",
  "8:5": "minor sixth",
  "13:8": "tridecimal sixth",
  "5:3": "major sixth",
  "7:4": "harmonic seventh",
  "16:9": "minor seventh",
  "9:5": "minor seventh",
  "15:8": "major seventh",
};

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function nameRatio(p: number, q: number): string | null {
  let octaves = 0;
  let a = p, b = q;
  while (a >= 2 * b) {
    if (a % 2 === 0) a /= 2;
    else b *= 2;
    const g = gcd(a, b);
    a /= g; b /= g;
    octaves++;
  }
  const base = BASE_NAMES[`${a}:${b}`];
  if (!base) return null;
  if (base === "unison" && octaves > 0) return octaves === 1 ? "octave" : `${octaves} octaves`;
  return octaves ? `${base} + ${octaves} oct` : base;
}

export function ratioToInterval(f1: number, f2: number, tolerance: number): IntervalInfo {
  const lo = Math.min(f1, f2);
  const hi = Math.max(f1, f2);
  const ratio = hi / lo;

  for (const [p, q] of convergents(ratio)) {
    const err = cents(ratio / (p / q));
    if (acceptsRatio(err, p, q, tolerance)) {
      return { p, q, name: nameRatio(p, q), complexity: Math.max(p, q), centsError: err, ratio };
    }
  }
  return { p: 0, q: 0, name: null, complexity: Infinity, centsError: 0, ratio };
}

export function complexityT(info: IntervalInfo): number {
  if (!info.p) return 1;
  const t = Math.max(0, (Math.log2(info.p * info.q) - 1) / (Math.log2(MAX_COMPLEXITY) - 1));
  return Math.min(1, Math.pow(t, 1.6));
}
