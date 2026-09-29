"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/AudioEngine";
import { frameFromParams, getCurve, listCurves, shareUrl, toleranceFor } from "@/lib/gallery/client";
import { FEATURED, featuredById, type FeaturedCurve } from "@/lib/gallery/examples";
import type { CurveRecord } from "@/lib/gallery/schema";
import { ratioToInterval } from "@/lib/ratio";
import { GalleryTile } from "./GalleryTile";
import { Visualizer } from "./Visualizer";

const STRIP_H = 76;

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; curves: CurveRecord[] };

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const noteOf = (c: CurveRecord) => (c as Partial<FeaturedCurve>).note;

export function Gallery() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState<CurveRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    listCurves()
      .then((curves) => setLoad({ state: "ready", curves }))
      .catch((err: Error) => setLoad({ state: "error", message: err.message }));
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("c");
    if (!id) return;
    const local = featuredById(id);
    if (local) setOpen(local);
    else getCurve(id).then(setOpen).catch(() => setOpen(null));
  }, []);

  useEffect(() => () => engineRef.current?.stopAll(), []);

  const togglePlay = useCallback(
    async (curve: CurveRecord) => {
      if (!engineRef.current) engineRef.current = new AudioEngine();
      const e = engineRef.current;
      await e.resume();
      if (playingId === curve.id) {
        e.stopTones();
        setPlayingId(null);
        return;
      }
      if (e.tonesPlaying) e.setTones(curve.params.f1, curve.params.f2);
      else e.playTones(curve.params.f1, curve.params.f2);
      setPlayingId(curve.id);
    },
    [playingId],
  );

  const show = useCallback((curve: CurveRecord | null) => {
    setOpen(curve);
    setCopied(false);
    const url = curve ? `/gallery?c=${encodeURIComponent(curve.id)}` : "/gallery";
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") show(null);
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "BUTTON") {
        e.preventDefault();
        togglePlay(open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show, togglePlay]);

  const copyLink = async () => {
    if (!open) return;
    try {
      await navigator.clipboard.writeText(shareUrl(open.id));
      setCopied(true);
    } catch {
    }
  };

  const openInfo = open ? ratioToInterval(open.params.f1, open.params.f2, toleranceFor(open.params)) : null;
  const openPlaying = open !== null && playingId === open.id;
  const saved = load.state === "ready" ? load.curves : [];

  const tile = (c: CurveRecord) => (
    <GalleryTile key={c.id} curve={c} note={noteOf(c)} playing={playingId === c.id} onOpen={show} onPlay={togglePlay} />
  );

  return (
    <main className="gallery-page">
      {open ? (
        <section className="gallery-view" aria-label={open.title}>
          <Visualizer
            getFrame={() => frameFromParams(open.params)}
            decay={open.params.decay}
            view={open.params.view}
            running={openPlaying}
            insetBottom={STRIP_H}
            onReadout={() => {}}
          />
          <header className="plate">
            <div className="plate-ratio">
              {openInfo?.p ? openInfo.p : "–"}
              <span className="ratio-sep">:</span>
              {openInfo?.p ? openInfo.q : "–"}
            </div>
            <div className="plate-name">{openInfo?.name ?? (openInfo?.p ? "unnamed ratio" : "no simple ratio")}</div>
            <div className="plate-title">{open.title}</div>
            {noteOf(open) && <div className="plate-note">{noteOf(open)}</div>}
            <div className="plate-sub">
              by {open.createdBy}
              {open.id.startsWith("ex-") ? "" : ` · ${date(open.createdAt)}`} · {open.params.f1.toFixed(2)} /{" "}
              {open.params.f2.toFixed(2)} Hz
              {open.params.tuning !== "detected" ? ` · ${open.params.tuning}` : " · from audio"}
            </div>
          </header>
          <div className="gallery-view-actions">
            <button className={`play ${openPlaying ? "on" : ""}`} onClick={() => togglePlay(open)}>
              {openPlaying ? "Silence" : "Sound"}
            </button>
            <button className="play plain" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button className="play plain" onClick={() => show(null)} aria-label="Close (Esc)">
              Close
            </button>
          </div>
        </section>
      ) : (
        <section className="gallery-grid-wrap" aria-label="Gallery">
          <header className="gallery-head">
            <h1>Gallery</h1>
            <p>Every curve is redrawn live from its two frequencies. Press play on any of them to hear it.</p>
          </header>

          <h2 className="gallery-section">Featured</h2>
          <p className="gallery-section-note">
            A tour from the purest consonance to true acoustic beats and the curve that never closes.
          </p>
          <div className="gallery-grid">{FEATURED.map(tile)}</div>

          <h2 className="gallery-section">From friends</h2>
          {load.state === "loading" && <p className="gallery-note">Loading…</p>}
          {load.state === "error" && <p className="gallery-note">{load.message}</p>}
          {load.state === "ready" && saved.length === 0 && (
            <p className="gallery-note">
              Nothing saved yet. Open the <Link href="/">instrument</Link>, find a shape you like, and press save.
            </p>
          )}
          {saved.length > 0 && <div className="gallery-grid">{saved.map(tile)}</div>}
        </section>
      )}

      <footer className="strip" style={{ height: STRIP_H }}>
        <div className="cell brand">Harmony</div>
        <nav className="cell modes" aria-label="Mode">
          <Link className="mode" href="/?mode=tone">
            Tone
          </Link>
          <Link className="mode" href="/?mode=file">
            File
          </Link>
          <Link className="mode" href="/?mode=mic">
            Listen
          </Link>
          <span className="mode on" aria-current="page">
            Gallery
          </span>
        </nav>
        <div className="cell controls" />
        <dl className="cell readout">
          <div>
            <dt>n</dt>
            <dd>{load.state === "ready" ? `${FEATURED.length + saved.length} curves` : "–"}</dd>
          </div>
        </dl>
      </footer>
    </main>
  );
}
