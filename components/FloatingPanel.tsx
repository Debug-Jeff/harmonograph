"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  storageKey: string;
  initial: { right: number; top: number };
  children: React.ReactNode;
}

type Pos = { x: number; y: number };

const MARGIN = 8;

function load(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Pos) : null;
  } catch {
    return null;
  }
}

function save(key: string, pos: Pos) {
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
  }
}

export function FloatingPanel({ title, storageKey, initial, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPosState] = useState<Pos | null>(null);
  const posRef = useRef<Pos | null>(null);
  const setPos = (next: Pos | null | ((p: Pos | null) => Pos | null)) => {
    if (typeof next !== "function") {
      posRef.current = next;
      setPosState(next);
      return;
    }
    setPosState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      posRef.current = value;
      return value;
    });
  };
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const clamp = (p: Pos): Pos => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 0, h = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - w - MARGIN),
      y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - h - MARGIN),
    };
  };

  useEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    setPos(clamp(load(storageKey) ?? { x: window.innerWidth - w - initial.right, y: initial.top }));
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [storageKey]);

  const move = (x: number, y: number) => setPos(clamp({ x, y }));

  return (
    <section
      ref={ref}
      className="panel"
      aria-label={title}
      style={pos ? { left: pos.x, top: pos.y } : { visibility: "hidden" }}
    >
      <header
        className="panel-grip"
        onPointerDown={(ev) => {
          const cur = posRef.current;
          if (!cur) return;
          ev.currentTarget.setPointerCapture(ev.pointerId);
          drag.current = { dx: ev.clientX - cur.x, dy: ev.clientY - cur.y };
        }}
        onPointerMove={(ev) => {
          if (drag.current) move(ev.clientX - drag.current.dx, ev.clientY - drag.current.dy);
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          if (posRef.current) save(storageKey, posRef.current);
        }}
        onKeyDown={(ev) => {
          const cur = posRef.current;
          if (!cur) return;
          const step = ev.shiftKey ? 40 : 10;
          const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
          if (!d) return;
          ev.preventDefault();
          const next = clamp({ x: cur.x + d[0], y: cur.y + d[1] });
          setPos(next);
          save(storageKey, next);
        }}
        tabIndex={0}
        aria-label={`${title} — drag or use arrow keys to move`}
      >
        <span className="panel-title">{title}</span>
        <span className="panel-dots" aria-hidden />
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
