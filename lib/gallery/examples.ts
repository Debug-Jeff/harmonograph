import type { CurveRecord } from "./schema";

export interface FeaturedCurve extends CurveRecord {
  note: string;
}

const A3 = 220;
const et = (semitones: number) => A3 * Math.pow(2, semitones / 12);
const at = "2026-09-27T00:00:00.000Z";

const featured = (
  id: string,
  title: string,
  f1: number,
  f2: number,
  note: string,
  opts: { tuning?: "just" | "equal"; decay?: number; view?: "flat" | "orbit" } = {},
): FeaturedCurve => ({
  id: `ex-${id}`,
  createdBy: "Harmony",
  title,
  note,
  createdAt: at,
  params: {
    f1,
    f2,
    tuning: opts.tuning ?? "just",
    decay: opts.decay ?? 0.08,
    view: opts.view ?? "flat",
    palette: "consonance",
  },
});

export const FEATURED: FeaturedCurve[] = [
  featured("octave", "Octave", A3, 2 * A3, "The simplest shape there is: one note, twice as fast. Closes on every cycle.", {
    decay: 0.06,
  }),
  featured("fifth", "Perfect fifth", A3, 1.5 * A3, "The power chord. Three against two, closing after three cycles.", {
    view: "orbit",
  }),
  featured("fourth", "Perfect fourth", A3, (4 / 3) * A3, "The fifth turned upside down — calm, open, a little unresolved."),
  featured("just-third", "Just major third", A3, 1.25 * A3, "Five against four, tuned by ear. Sweet and perfectly still."),
  featured(
    "tempered-third",
    "Piano major third",
    A3,
    et(4),
    "Fourteen cents sharp of 5:4 — the compromise every piano makes. Watch it drift.",
    { tuning: "equal" },
  ),
  featured("barbershop", "Barbershop seventh", A3, 1.75 * A3, "Seven against four: the seventh singers lock into by ear, and no piano can play.", {
    view: "orbit",
    decay: 0.06,
  }),
  featured("slow-beat", "Slow beat", A3, A3 + 1, "Two notes one hertz apart. The sound swells once a second and the figure breathes with it.", {
    decay: 0.03,
  }),
  featured("shimmer", "Shimmer", 2 * A3, 2 * A3 + 6, "Six hertz apart: the beating turns into a vibrato-like shimmer.", {
    decay: 0.04,
  }),
  featured("rough", "Roughness", 2 * A3, 2 * A3 + 25, "Twenty-five hertz apart, beats blur into a rasp — the ear's idea of dissonance.", {
    decay: 0.05,
  }),
  featured("tritone", "Tritone", A3, et(6), "Half an octave, √2. Irrational, so it never closes — the 'devil in music'.", {
    tuning: "equal",
  }),
  featured("golden", "Golden ratio", A3, A3 * ((1 + Math.sqrt(5)) / 2), "The most irrational number there is. The curve never repeats, however long you watch.", {
    view: "orbit",
    decay: 0.05,
  }),
];

export const featuredById = (id: string) => FEATURED.find((c) => c.id === id) ?? null;
