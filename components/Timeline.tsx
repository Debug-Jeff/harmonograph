"use client";

import { useEffect, useRef } from "react";
import type { AudioEngine } from "@/lib/audio/AudioEngine";
import { GHOST, GOLD, curveColor, rgba } from "@/lib/curve";
import { complexityT } from "@/lib/ratio";
import type { Readout } from "./Visualizer";

interface Props {
  engine: AudioEngine | null;
  fileVersion: number;
  readout: Readout;
  height: number;
  bottom: number;
}

const UNHEARD = -2;
const SINGLE_VOICE = -1;

const MAX_BRIDGE = 120;

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export function Timeline({ engine, fileVersion, readout, height, bottom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  const tint = useRef<Float32Array>(new Float32Array(0));
  const ridgeDirty = useRef(true);
  const scrub = useRef<number | null>(null);
  const lastCol = useRef<number | null>(null);

  useEffect(() => {
    if (!engine?.filePlaying || tint.current.length === 0 || readout.kind === "idle") return;
    const col = Math.floor((engine.fileTime / engine.fileDuration) * tint.current.length);
    if (col < 0 || col >= tint.current.length) return;
    const value = readout.kind === "harmonic" ? complexityT(readout.info) : SINGLE_VOICE;
    const prev = lastCol.current;
    const from = prev !== null && col > prev && col - prev <= MAX_BRIDGE ? prev + 1 : col;
    tint.current.fill(value, from, col + 1);
    lastCol.current = col;
    ridgeDirty.current = true;
  }, [engine, readout]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    const ridge = document.createElement("canvas");
    const rg = ridge.getContext("2d")!;
    let peaks: Float32Array = new Float32Array(0);
    let norm = 1;
    let dpr = 1;
    tint.current = new Float32Array(0); 

    const layout = () => {
      dpr = window.devicePixelRatio || 1;
      const w = Math.round(wrap.clientWidth * dpr);
      const h = Math.round(wrap.clientHeight * dpr);
      canvas.width = ridge.width = w;
      canvas.height = ridge.height = h;
      peaks = engine?.filePeaks(w) ?? new Float32Array(0);
      norm = 1e-4;
      for (let i = 0; i < peaks.length; i++) norm = Math.max(norm, Math.abs(peaks[i]));
      const old = tint.current;
      const next = new Float32Array(w).fill(UNHEARD);
      if (old.length) for (let i = 0; i < w; i++) next[i] = old[Math.floor((i * old.length) / w)];
      tint.current = next;
      ridgeDirty.current = true;
    };

    const drawRidge = () => {
      const w = ridge.width, h = ridge.height;
      const base = Math.round(h * 0.62);
      rg.clearRect(0, 0, w, h);
      const cols = peaks.length / 2;
      for (let x = 0; x < cols; x++) {
        const lo = Math.abs(peaks[x * 2]) / norm;
        const hi = peaks[x * 2 + 1] / norm;
        const t = tint.current[x];
        const color = t < 0 ? GHOST : curveColor(t);
        const a = t === UNHEARD ? 0.22 : t === SINGLE_VOICE ? 0.45 : 0.9;
        rg.fillStyle = rgba(color, a);
        const up = Math.max(1, hi * (base - 4 * dpr));
        rg.fillRect(x, base - up, 1, up);
        rg.fillStyle = rgba(color, a * 0.3);
        rg.fillRect(x, base + 1 * dpr, 1, lo * (h - base) * 0.8);
      }

      rg.globalCompositeOperation = "destination-out";
      rg.fillStyle = "#000";
      const pitch = Math.max(2, Math.round(2.5 * dpr));
      for (let y = base - 1; y > 0; y -= pitch) rg.fillRect(0, y, w, Math.max(1, Math.round(dpr * 0.9)));
      for (let y = base + 2; y < h; y += pitch) rg.fillRect(0, y, w, Math.max(1, Math.round(dpr * 1.4)));
      rg.globalCompositeOperation = "source-over";
      rg.fillStyle = rgba(GOLD, 0.55);
      rg.fillRect(0, base, w, Math.max(1, Math.round(dpr)));
      ridgeDirty.current = false;
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);

    let raf = 0;
    const tick = () => {
      if (ridgeDirty.current) drawRidge();
      const w = canvas.width, h = canvas.height;
      g.clearRect(0, 0, w, h);
      g.drawImage(ridge, 0, 0);

      const dur = engine?.fileDuration ?? 0;
      if (dur > 0) {
        const time = scrub.current ?? engine!.fileTime;
        const x = Math.round((time / dur) * w) + 0.5;
        g.fillStyle = rgba(GOLD, 0.95);
        g.fillRect(x - 0.5, 0, Math.max(1, dpr), h);
        g.beginPath();
        g.arc(x, 3.5 * dpr, 3 * dpr, 0, Math.PI * 2);
        g.fill();
        if (timeRef.current) timeRef.current.textContent = `${clock(time)} / ${clock(dur)}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine, fileVersion]);

  const timeAt = (ev: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    return f * (engine?.fileDuration ?? 0);
  };

  return (
    <div
      ref={wrapRef}
      className="timeline"
      style={{ height, bottom }}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(engine?.fileDuration ?? 0)}
      onPointerDown={(ev) => {
        if (!engine?.hasFile) return;
        ev.currentTarget.setPointerCapture(ev.pointerId);
        scrub.current = timeAt(ev);
      }}
      onPointerMove={(ev) => {
        if (scrub.current !== null) scrub.current = timeAt(ev);
      }}
      onPointerUp={(ev) => {
        if (scrub.current === null) return;
        engine?.seekFile(timeAt(ev));
        scrub.current = null;
        lastCol.current = null;
      }}
    >
      <canvas ref={canvasRef} />
      <span ref={timeRef} className="timeline-clock" />
    </div>
  );
}
