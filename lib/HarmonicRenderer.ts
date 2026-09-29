import {
  GHOST,
  GOLD,
  curveAlpha,
  curveColor,
  curveSpan,
  rgba,
  type CurveRenderer,
  type CurveStyle,
  type HarmonicParams,
} from "./curve";

const MAX_POINTS = 90_000;
const CHUNK = 48;

export class HarmonicRenderer implements CurveRenderer {
  private ctx: CanvasRenderingContext2D;
  private field: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cx = 0;
  private cy = 0;
  private R = 0;

  private maxPoints: number;

  constructor(canvas: HTMLCanvasElement, fieldCanvas: HTMLCanvasElement, { maxPoints = MAX_POINTS } = {}) {
    this.maxPoints = maxPoints;
    this.ctx = canvas.getContext("2d")!;
    this.field = fieldCanvas.getContext("2d")!;
  }

  resize(cssW: number, cssH: number, dpr: number, insetBottom: number) {
    this.dpr = dpr;
    this.w = Math.round(cssW * dpr);
    this.h = Math.round(cssH * dpr);
    for (const c of [this.ctx, this.field]) {
      c.canvas.width = this.w;
      c.canvas.height = this.h;
    }
    const usableH = this.h - insetBottom * dpr;
    this.cx = this.w / 2;
    this.cy = usableH / 2;
    this.R = Math.min(this.w, usableH) * 0.36;
    this.drawField();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  present() {}

  dispose() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.field.clearRect(0, 0, this.w, this.h);
  }

  drawHarmonic(params: HarmonicParams, style: CurveStyle) {
    const { ctx, cx, cy, R, dpr } = this;
    const span = curveSpan(params, style, this.maxPoints);
    if (!span) return;
    const { n, dt, r, decayPerRad } = span;
    const { phase1, phase2 } = params;

    const color = curveColor(style.complexityT);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 0.9 * dpr;
    ctx.lineJoin = "round";

    for (let start = 0; start < n; start += CHUNK) {
      const t0 = start * dt;
      const env = Math.exp(-decayPerRad * t0);
      ctx.strokeStyle = rgba(color, curveAlpha(env));
      ctx.beginPath();
      const end = Math.min(n, start + CHUNK);
      for (let i = start; i <= end; i++) {
        const t = i * dt;
        const a = R * Math.exp(-decayPerRad * t);
        const x = cx + a * Math.sin(t + phase1);
        const y = cy - a * Math.sin(r * t + phase2);
        if (i === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const px = cx + R * Math.sin(phase1);
    const py = cy - R * Math.sin(phase2);
    ctx.fillStyle = rgba(color, 0.95);
    ctx.beginPath();
    ctx.arc(px, py, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawScope(samples: Float32Array, delay: number) {
    const { ctx, cx, cy, R, dpr } = this;
    let peak = 1e-4;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const k = R / peak;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 0.8 * dpr;
    ctx.strokeStyle = rgba(GHOST, 0.45);
    ctx.setLineDash([2 * dpr, 3 * dpr]);
    ctx.beginPath();
    for (let i = delay; i < samples.length; i++) {
      const x = cx + samples[i] * k;
      const y = cy - samples[i - delay] * k;
      if (i === delay) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawField() {
    const { field: g, w, h, cx, cy, R, dpr } = this;
    g.clearRect(0, 0, w, h);

    const step = 22 * dpr;
    const ox = cx % step, oy = cy % step;
    for (let y = oy; y < h; y += step) {
      for (let x = ox; x < w; x += step) {
        const dist = Math.hypot(x - cx, y - cy) / (R * 2.2);
        const a = 0.05 + 0.1 * Math.max(0, 1 - dist);
        g.fillStyle = rgba(GHOST, a);
        g.fillRect(x - 0.5 * dpr, y - 0.5 * dpr, 1 * dpr, 1 * dpr);
      }
    }

    for (let k = 1; k <= 7; k++) {
      const rr = (R * k) / 8;
      const count = Math.round((2 * Math.PI * rr) / (5 * dpr));
      g.fillStyle = rgba(GOLD, 0.1 + 0.02 * k);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        g.fillRect(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 0.9 * dpr, 0.9 * dpr);
      }
    }

    g.lineWidth = 1 * dpr;

    g.strokeStyle = rgba(GOLD, 0.28);
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([3 * dpr, 5 * dpr]);
    g.strokeStyle = rgba(GHOST, 0.18);
    g.beginPath();
    g.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = rgba(GHOST, 0.1);
    g.strokeRect(cx - R, cy - R, 2 * R, 2 * R);
    g.beginPath();
    g.moveTo(cx - R * 1.5, cy + R * 0.55);
    g.lineTo(cx + R * 1.5, cy - R * 0.55);
    g.moveTo(cx - R * 1.5, cy - R * 0.55);
    g.lineTo(cx + R * 1.5, cy + R * 0.55);
    g.stroke();
    g.setLineDash([]);

    const ext = R * 1.55;
    g.strokeStyle = rgba(GOLD, 0.5);
    g.beginPath();
    g.moveTo(cx - ext, cy);
    g.lineTo(cx + ext, cy);
    g.moveTo(cx, cy - ext);
    g.lineTo(cx, cy + ext);
    g.stroke();

    g.strokeStyle = rgba(GOLD, 0.45);
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const off = (R / 8) * i;
      const len = (i % 4 === 0 ? 7 : 3) * dpr;
      g.beginPath();
      g.moveTo(cx + off, cy - len);
      g.lineTo(cx + off, cy + len);
      g.moveTo(cx - len, cy + off);
      g.lineTo(cx + len, cy + off);
      g.stroke();
    }

    g.fillStyle = rgba(GOLD, 0.7);
    for (const [x, y] of [[cx - ext, cy], [cx + ext, cy], [cx, cy - ext], [cx, cy + ext]]) {
      g.beginPath();
      g.arc(x, y, 2.6 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }
}
