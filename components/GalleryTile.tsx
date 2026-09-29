"use client";

import { useEffect, useRef } from "react";
import { CurveAnimator } from "@/lib/CurveAnimator";
import { HarmonicRenderer } from "@/lib/HarmonicRenderer";
import { frameFromParams, toleranceFor } from "@/lib/gallery/client";
import type { CurveRecord } from "@/lib/gallery/schema";
import { ratioToInterval } from "@/lib/ratio";
import { subscribe } from "@/lib/ticker";

const TILE_POINTS = 14_000;

interface Props {
  curve: CurveRecord;
  note?: string;
  playing: boolean;
  onOpen: (curve: CurveRecord) => void;
  onPlay: (curve: CurveRecord) => void;
}

export function GalleryTile({ curve, note, playing, onOpen, onPlay }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const curveRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const wrap = wrapRef.current!;
    const renderer = new HarmonicRenderer(curveRef.current!, fieldRef.current!, { maxPoints: TILE_POINTS });
    const animator = new CurveAnimator();
    const frame = frameFromParams(curve.params);
    const canvasBox = curveRef.current!.parentElement!;

    const resize = () => renderer.resize(canvasBox.clientWidth, canvasBox.clientHeight, window.devicePixelRatio || 1, 0);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvasBox);

    let unsubscribe: (() => void) | null = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !unsubscribe) {
        unsubscribe = subscribe((now) => animator.step(now, frame, curve.params.decay, renderer, playingRef.current));
      } else if (!entry.isIntersecting && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    });
    io.observe(wrap);

    return () => {
      unsubscribe?.();
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
    };
  }, [curve]);

  const info = ratioToInterval(curve.params.f1, curve.params.f2, toleranceFor(curve.params));
  const label = info.p ? `${info.p}:${info.q} · ${info.name ?? "unnamed"}` : "never closes";

  return (
    <div ref={wrapRef} className={`tile ${playing ? "playing" : ""}`}>
      <button className="tile-open" onClick={() => onOpen(curve)} aria-label={`Open ${curve.title}`}>
        <span className="tile-canvas">
          <canvas ref={fieldRef} aria-hidden />
          <canvas ref={curveRef} aria-hidden />
        </span>
        <span className="tile-title">{curve.title}</span>
        {note && <span className="tile-note">{note}</span>}
        <span className="tile-meta">
          <span>{label}</span>
          <span>{curve.createdBy}</span>
        </span>
      </button>
      <button
        className={`tile-play ${playing ? "on" : ""}`}
        onClick={() => onPlay(curve)}
        aria-pressed={playing}
        aria-label={playing ? `Stop ${curve.title}` : `Play ${curve.title}`}
      >
        <span aria-hidden className="tile-play-icon" />
      </button>
    </div>
  );
}
