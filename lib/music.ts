export type Tuning = "just" | "equal";

export interface IntervalPreset {
  id: string;
  label: string;
  just: [number, number] | null;
  semis: number | null;
  fixed?: number;
}

export const INTERVALS: IntervalPreset[] = [
  { id: "P1", label: "Unison", just: [1, 1], semis: 0 },
  { id: "m2", label: "Minor 2nd", just: [16, 15], semis: 1 },
  { id: "M2", label: "Major 2nd", just: [9, 8], semis: 2 },
  { id: "m3", label: "Minor 3rd", just: [6, 5], semis: 3 },
  { id: "M3", label: "Major 3rd", just: [5, 4], semis: 4 },
  { id: "P4", label: "Fourth", just: [4, 3], semis: 5 },
  { id: "TT", label: "Tritone", just: [45, 32], semis: 6 },
  { id: "P5", label: "Fifth", just: [3, 2], semis: 7 },
  { id: "m6", label: "Minor 6th", just: [8, 5], semis: 8 },
  { id: "M6", label: "Major 6th", just: [5, 3], semis: 9 },
  { id: "h7", label: "Harmonic 7th", just: [7, 4], semis: null },
  { id: "m7", label: "Minor 7th", just: [16, 9], semis: 10 },
  { id: "M7", label: "Major 7th", just: [15, 8], semis: 11 },
  { id: "P8", label: "Octave", just: [2, 1], semis: 12 },
  { id: "phi", label: "Golden φ", just: null, semis: null, fixed: (1 + Math.sqrt(5)) / 2 },
];

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export interface Note {
  midi: number;
  name: string;
  freq: number;
}

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const ROOTS: Note[] = Array.from({ length: 24 }, (_, i) => {
  const midi = 48 + i;
  return { midi, name: `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`, freq: midiToFreq(midi) };
});

export function intervalRatio(preset: IntervalPreset, tuning: Tuning): number {
  if (preset.fixed) return preset.fixed;
  if (tuning === "equal" && preset.semis !== null) return Math.pow(2, preset.semis / 12);
  const [p, q] = preset.just!;
  return p / q;
}
