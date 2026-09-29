export interface PitchCandidate {
  freq: number;
  salience: number;
}

export interface DetectionResult {
  voices: PitchCandidate[];
  confidence: number;
}

const MIN_HZ = 60;
const MAX_HZ = 2000;
const HARMONICS = 6;
const HARMONIC_TOL = 0.018;
const FLOOR_DB = -80;

interface Peak {
  freq: number;
  mag: number;
}

export class PitchDetector {
  private db: Float32Array<ArrayBuffer>;
  private mag: Float32Array<ArrayBuffer>;
  private binHz: number;

  constructor(private analyser: AnalyserNode) {
    this.db = new Float32Array(analyser.frequencyBinCount);
    this.mag = new Float32Array(analyser.frequencyBinCount);
    this.binHz = analyser.context.sampleRate / analyser.fftSize;
  }

  detect(): DetectionResult {
    this.analyser.getFloatFrequencyData(this.db);
    const { db, mag, binHz } = this;
    for (let i = 0; i < db.length; i++) mag[i] = db[i] > FLOOR_DB ? Math.pow(10, db[i] / 20) : 0;

    const peaks = this.findPeaks();
    if (peaks.length === 0) return { voices: [], confidence: 0 };

    const salience = (f0: number) => {
      let s = 0;
      for (let h = 1; h <= HARMONICS; h++) {
        const bin = Math.round((f0 * h) / binHz);
        if (bin >= mag.length) break;
        const m = Math.max(mag[bin - 1] ?? 0, mag[bin], mag[bin + 1] ?? 0);
        s += m / Math.sqrt(h);
      }
      return s;
    };

    const candidates = peaks
      .filter((p) => p.freq <= MAX_HZ)
      .map((p) => ({ freq: p.freq, salience: salience(p.freq) }))
      .sort((a, b) => b.salience - a.salience);

    const first = candidates[0];
    const isHarmonicOfFirst = (f: number) => {
      const h = Math.round(f / first.freq);
      return h >= 1 && Math.abs(f / (first.freq * h) - 1) < HARMONIC_TOL;
    };
    const second = candidates.find((c) => !isHarmonicOfFirst(c.freq));

    if (!second) return { voices: [first], confidence: 0 };
    return {
      voices: [first, second],
      confidence: Math.min(1, second.salience / first.salience),
    };
  }

  private findPeaks(): Peak[] {
    const { db, mag, binHz } = this;
    const lo = Math.max(2, Math.floor(MIN_HZ / binHz));
    const hi = Math.min(db.length - 2, Math.ceil((MAX_HZ * HARMONICS) / binHz));

    let loudest = -Infinity;
    for (let i = lo; i < hi; i++) if (db[i] > loudest) loudest = db[i];
    const threshold = Math.max(FLOOR_DB, loudest - 40);

    const peaks: Peak[] = [];
    for (let i = lo; i < hi; i++) {
      const c = db[i];
      if (c < threshold || c < db[i - 1] || c <= db[i + 1]) continue;
      const a = db[i - 1], b = db[i + 1];
      const denom = a - 2 * c + b;
      const offset = denom === 0 ? 0 : (0.5 * (a - b)) / denom;
      peaks.push({ freq: (i + offset) * binHz, mag: mag[i] });
    }
    return peaks.sort((x, y) => y.mag - x.mag).slice(0, 16);
  }
}
