import type { Frame } from "./audio/AudioEngine";
import type { CurveRenderer } from "./curve";
import { complexityT, ratioToInterval, type IntervalInfo } from "./ratio";

export type Readout =
  | { kind: "harmonic"; f1: number; f2: number; info: IntervalInfo; confidence: number }
  | { kind: "scope"; confidence: number }
  | { kind: "idle" };

const BASE_DRIFT = 0.22;
const MAX_BEAT_HZ = 1.5;
const STILL_PHASE = Math.PI / 4;

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export class CurveAnimator {
  private key = "";
  private last: number | null = null;
  private clock = 0;
  private revealStart = -Infinity;
  private drift = 0;
  private beat = 0;

  step(now: number, frame: Frame | null, decay: number, renderer: CurveRenderer | null, running: boolean): Readout {
    const wallDt = this.last === null ? 0 : Math.min(100, now - this.last);
    this.last = now;
    const dt = running ? wallDt / 1000 : 0;
    this.clock += dt * 1000;
    renderer?.clear();

    if (frame?.kind === "harmonic") {
      const info = ratioToInterval(frame.f1, frame.f2, frame.tolerance);
      const k = info.p ? `${info.p}:${info.q}` : "none";
      if (k !== this.key) {
        this.key = k;
        this.revealStart = running ? this.clock : -Infinity;
      }

      const revealMs = 600 + 90 * Math.min(info.complexity, 40);
      const reveal = easeOut(Math.min(1, (this.clock - this.revealStart) / revealMs));

      this.drift += dt * BASE_DRIFT;
      if (info.p) {
        const lo = Math.min(frame.f1, frame.f2);
        const hi = Math.max(frame.f1, frame.f2);
        const beatHz = hi - (lo * info.p) / info.q;
        this.beat += dt * 2 * Math.PI * Math.max(-MAX_BEAT_HZ, Math.min(MAX_BEAT_HZ, beatHz));
      }

      renderer?.drawHarmonic(
        {
          f1: frame.f1,
          f2: frame.f2,
          phase1: 0,
          phase2: STILL_PHASE + this.drift + this.beat,
          decay,
        },
        { complexityT: complexityT(info), closureCycles: info.p ? info.q : null, reveal },
      );
      renderer?.present();
      return { kind: "harmonic", f1: frame.f1, f2: frame.f2, info, confidence: frame.confidence };
    }

    this.key = "";
    if (frame?.kind === "scope") {
      renderer?.drawScope(frame.samples, frame.delay);
      renderer?.present();
      return { kind: "scope", confidence: frame.confidence };
    }
    renderer?.present();
    return { kind: "idle" };
  }
}
