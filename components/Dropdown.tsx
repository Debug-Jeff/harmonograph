"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
  detail?: string;
  swatch?: string;
  muted?: boolean;
  group?: string;
  cell?: string;
}

interface Props {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  layout?: "list" | "grid";
  columns?: number;
  display?: string;
}

const GAP = 10;
const MARGIN = 12;

export function Dropdown({ label, value, options, onChange, layout = "list", columns = 12, display }: Props) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; bottom: number; maxHeight: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  const place = () => {
    const b = buttonRef.current!.getBoundingClientRect();
    const top = buttonRef.current!.parentElement!.getBoundingClientRect().top;
    const width = listRef.current?.offsetWidth ?? 0;
    const left = Math.min(Math.max(MARGIN, b.left - 12), window.innerWidth - width - MARGIN);
    setPos({ left, bottom: window.innerHeight - top + GAP, maxHeight: top - GAP - MARGIN });
  };

  const openList = () => {
    setActive(selectedIndex);
    setPos(null);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (i: number) => {
    onChange(options[i].value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    listRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    const onMove = () => close(false);
    const strip = buttonRef.current?.closest(".controls");
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onMove);
    strip?.addEventListener("scroll", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onMove);
      strip?.removeEventListener("scroll", onMove);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const step = layout === "grid" ? columns : 1;
    const moves: Record<string, number> = {
      ArrowDown: step,
      ArrowUp: -step,
      ...(layout === "grid" ? { ArrowRight: 1, ArrowLeft: -1 } : {}),
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive((i) => Math.min(last, Math.max(0, i + moves[e.key])));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current.text = (now - typed.current.at > 700 ? "" : typed.current.text) + e.key.toLowerCase();
      typed.current.at = now;
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
  };

  const renderOption = (o: DropdownOption, i: number) => (
    <div
      key={o.value}
      id={`${id}-opt-${i}`}
      data-index={i}
      role="option"
      aria-selected={i === selectedIndex}
      aria-label={layout === "grid" && o.cell ? o.label : undefined}
      className={[
        "dd-option",
        i === active ? "active" : "",
        i === selectedIndex ? "selected" : "",
        o.muted ? "muted" : "",
      ].join(" ")}
      onPointerEnter={() => setActive(i)}
      onClick={() => choose(i)}
    >
      {o.swatch && <span className="dd-swatch" style={{ background: o.swatch }} aria-hidden />}
      <span className="dd-label">{layout === "grid" && o.cell ? o.cell : o.label}</span>
      {o.detail && <span className="dd-detail">{o.detail}</span>}
    </div>
  );

  const groups = layout === "grid" ? Array.from(new Set(options.map((o) => o.group ?? ""))) : [];

  return (
    <div className="field">
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`dd-button ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
      >
        <span id={`${id}-value`}>{display ?? selected?.label}</span>
        <svg className="dd-chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            aria-activedescendant={`${id}-opt-${active}`}
            className={`dd-popup ${layout}`}
            style={
              pos
                ? { left: pos.left, bottom: pos.bottom, maxHeight: pos.maxHeight }
                :
                  { opacity: 0, left: 0, bottom: 0 }
            }
            onKeyDown={onListKey}
          >
            {layout === "grid"
              ? groups.map((g) => (
                  <div className="dd-row" key={g} role="presentation">
                    <span className="dd-row-label" aria-hidden>
                      {g}
                    </span>
                    <div className="dd-cells" role="presentation" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                      {options.map((o, i) => (o.group === g ? renderOption(o, i) : null))}
                    </div>
                  </div>
                ))
              : options.map(renderOption)}
          </div>,
          document.body,
        )}
    </div>
  );
}
