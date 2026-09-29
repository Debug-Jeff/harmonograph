"use client";

import { useEffect, useRef, useState } from "react";
import type { Frame } from "@/lib/audio/AudioEngine";
import { CurveAnimator, type Readout } from "@/lib/CurveAnimator";
import type { CurveRenderer } from "@/lib/curve";
import { HarmonicRenderer } from "@/lib/HarmonicRenderer";

export type { Readout };

export type View = "flat" | "orbit";

interface Props {
  getFrame: () => Frame | null;
  decay: number;
  view: View;
  running: boolean;
  insetBottom: number;
  onReadout: (r: Readout) => void;
}

const READOUT_MS = 100;

export function Visualizer({ getFrame, decay, view, running, insetBottom, onReadout }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const curveRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const orbitCanvasRef = useRef<HTMLCanvasElement>(null);

  const flat = useRef<HarmonicRenderer | null>(null);
  const orbit = useRef<CurveRenderer | null>(null);
  const [orbitReady, setOrbitReady] = useState(false);

  const live = useRef({ getFrame, decay, view, running, insetBottom, onReadout });
  live.current = { getFrame, decay, view, running, insetBottom, onReadout };

  const layout = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dpr = window.devicePixelRatio || 1;
    for (const r of [flat.current, orbit.current]) {
      r?.resize(stage.clientWidth, stage.clientHeight, dpr, live.current.insetBottom);
    }
  };

  useEffect(() => {
    if (view !== "orbit") return;
    let cancelled = false;
    import("@/lib/OrbitRenderer").then(({ OrbitRenderer }) => {
      if (cancelled || !orbitCanvasRef.current) return;
      orbit.current = new OrbitRenderer(orbitCanvasRef.current);
      layout();
      setOrbitReady(true);
    });
    return () => {
      cancelled = true;
      orbit.current?.dispose();
      orbit.current = null;
      setOrbitReady(false);
    };
  }, [view]);

  useEffect(layout, [insetBottom]);

  useEffect(() => {
    const stage = stageRef.current!;
    flat.current = new HarmonicRenderer(curveRef.current!, fieldRef.current!);
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stage);

    let raf = 0;
    let lastReadout = 0;
    const animator = new CurveAnimator();

    const tick = (now: number) => {
      const { getFrame, decay, view, running, onReadout } = live.current;
      const renderer = view === "orbit" ? orbit.current : flat.current;
      const readout = animator.step(now, getFrame(), decay, renderer, running);

      if (now - lastReadout > READOUT_MS) {
        lastReadout = now;
        onReadout(readout);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      flat.current?.dispose();
      flat.current = null;
    };
  }, []);

  const showOrbit = view === "orbit";
  return (
    <div ref={stageRef} className={`stage ${showOrbit ? "orbit" : "flat"}`}>
      <canvas ref={fieldRef} className="layer-flat" aria-hidden />
      <canvas ref={curveRef} className="layer-flat" role="img" aria-label="Harmonograph of the current interval" />
      {showOrbit && (
        <canvas
          ref={orbitCanvasRef}
          className={`layer-orbit ${orbitReady ? "ready" : ""}`}
          role="img"
          aria-label="Harmonograph as a 3D curve on x, y and z axes; drag to walk around it"
        />
      )}
    </div>
  );
}
