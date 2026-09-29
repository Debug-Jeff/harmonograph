"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine, MIN_CONFIDENCE, type CaptureSource, type Frame, type Mode } from "@/lib/audio/AudioEngine";
import { INTERVALS, ROOTS, intervalRatio, type Tuning } from "@/lib/music";
import type { CurveParams } from "@/lib/gallery/schema";
import { curveColor } from "@/lib/curve";
import { TOLERANCE_CENTS, complexityT, ratioToInterval } from "@/lib/ratio";
import { Dropdown, type DropdownOption } from "./Dropdown";
import { FloatingPanel } from "./FloatingPanel";
import { SaveCurve } from "./SaveCurve";
import { Tabular } from "./Tabular";
import { Timeline } from "./Timeline";
import { Visualizer, type Readout, type View } from "./Visualizer";

const STRIP_H = 76;
const TIMELINE_H = 64;

const MODES: { id: Mode; label: string }[] = [
  { id: "tone", label: "Tone" },
  { id: "file", label: "File" },
  { id: "mic", label: "Listen" },
];

const SOURCES: { id: CaptureSource | "system"; label: string; hint: string }[] = [
  { id: "mic", label: "mic", hint: "Microphone" },
  { id: "tab", label: "tab", hint: "Another tab's audio — the browser will ask which tab, tick “share audio”" },
  { id: "system", label: "system", hint: "All audio on this machine — coming with the desktop app" },
];

const hz = (f: number) => `${f.toFixed(2)} Hz`;
const signedCents = (c: number) => `${c >= 0 ? "+" : "−"}${Math.abs(c).toFixed(1)}¢`;

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") return "Permission was declined or sharing was cancelled.";
  return err instanceof Error ? err.message : String(err);
}

export function HarmonyApp() {
  const [mode, setMode] = useState<Mode>("tone");
  const [view, setView] = useState<View>("flat");
  const [rootMidi, setRootMidi] = useState(57);
  const [intervalId, setIntervalId] = useState("P5");
  const [tuning, setTuning] = useState<Tuning>("just");
  const [detune, setDetune] = useState(0);
  const [decay, setDecay] = useState(0.08);
  const [source, setSource] = useState<CaptureSource>("mic");
  const [playing, setPlaying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileVersion, setFileVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readout, setReadout] = useState<Readout>({ kind: "idle" });

  const engineRef = useRef<AudioEngine | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const check = () => el.classList.toggle("overflowing", el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    check();
    return () => ro.disconnect();
  }, [mode]);

  const rootOptions: DropdownOption[] = ROOTS.map((n) => ({
    value: String(n.midi),
    label: n.name,
    cell: n.name.replace(/\d+$/, ""),
    group: n.name.match(/\d+$/)![0],
    muted: n.name.includes("♯"),
  }));

  const intervalOptions: DropdownOption[] = INTERVALS.map((i) => {
    const info = ratioToInterval(220, 220 * intervalRatio(i, tuning), TOLERANCE_CENTS.exact);
    const approx = tuning === "equal" && i.semis !== null && i.semis % 12 !== 0;
    return {
      value: i.id,
      label: i.label,
      detail: i.just ? `${approx ? "≈ " : ""}${i.just[0]}:${i.just[1]}` : "irrational",
      swatch: `rgb(${curveColor(complexityT(info)).join(",")})`,
    };
  });

  const root = ROOTS.find((r) => r.midi === rootMidi)!;
  const preset = INTERVALS.find((i) => i.id === intervalId)!;
  const f1 = root.freq;
  const f2 = f1 * intervalRatio(preset, tuning) * Math.pow(2, detune / 1200);

  const engine = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
      engineRef.current.onFileEnded = () => setPlaying(false);
      engineRef.current.onCaptureEnded = () => setPlaying(false);
    }
    await engineRef.current.resume();
    return engineRef.current;
  }, []);

  const toneRef = useRef({ f1, f2 });
  toneRef.current = { f1, f2 };

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const playingRef = useRef(playing);
  playingRef.current = playing;

  const sourceRef = useRef(source);
  sourceRef.current = source;

  const heldFrame = useRef<Frame | null>(null);

  const getFrame = useCallback((): Frame | null => {
    if (modeRef.current === "tone") {
      const { f1, f2 } = toneRef.current;
      return { kind: "harmonic", f1, f2, tolerance: TOLERANCE_CENTS.exact, confidence: 1 };
    }
    const live = engineRef.current?.readDetectedFrame() ?? null;
    if (live) {
      heldFrame.current = live.kind === "scope" ? { ...live, samples: live.samples.slice() } : live;
      return live;
    }
    return playingRef.current ? null : heldFrame.current;
  }, []);

  useEffect(() => {
    if (mode === "tone" && playing) engineRef.current?.setTones(f1, f2);
  }, [mode, playing, f1, f2]);

  useEffect(() => () => engineRef.current?.stopAll(), []);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "tone" || m === "file" || m === "mic") setMode(m);
  }, []);

  const readoutRef = useRef(readout);
  readoutRef.current = readout;

  const getSaveParams = (): CurveParams | null => {
    const base = { decay, view, palette: "consonance" as const };
    if (mode === "tone") return { f1, f2, tuning, ...base };
    const r = readoutRef.current;
    return r.kind === "harmonic" ? { f1: r.f1, f2: r.f2, tuning: "detected", ...base } : null;
  };

  const suggestTitle = () => {
    const r = readoutRef.current;
    const name = r.kind === "harmonic" ? (r.info.name ?? (r.info.p ? `${r.info.p}:${r.info.q}` : "Never closes")) : "Curve";
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    return mode === "tone" ? `${cap} on ${root.name}, ${tuning}` : cap;
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    engineRef.current?.stopAll();
    heldFrame.current = null;
    setPlaying(false);
    setError(null);
    setMode(next);
  };

  const switchSource = (next: CaptureSource) => {
    if (next === source) return;
    engineRef.current?.stopCapture();
    setPlaying(false);
    setError(null);
    setSource(next);
  };

  const togglePlay = useCallback(async () => {
    setError(null);
    const e = await engine();
    try {
      if (modeRef.current === "tone") {
        if (e.tonesPlaying) e.stopTones();
        else e.playTones(toneRef.current.f1, toneRef.current.f2);
        setPlaying(e.tonesPlaying);
      } else if (modeRef.current === "file") {
        if (!e.hasFile) return;
        if (e.filePlaying) e.pauseFile();
        else e.playFile();
        setPlaying(e.filePlaying);
      } else {
        if (e.captureActive) e.stopCapture();
        else await e.startCapture(sourceRef.current);
        setPlaying(e.captureActive);
      }
    } catch (err) {
      setError(describeError(err));
      setPlaying(false);
    }
  }, [engine]);

  const loadFile = async (file: File) => {
    setError(null);
    setPlaying(false);
    try {
      const e = await engine();
      await e.loadFile(file);
      heldFrame.current = null;
      setFileName(file.name);
      setFileVersion((v) => v + 1);
      e.playFile();
      setPlaying(true);
    } catch {
      setError(`Couldn't decode ${file.name}`);
    }
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code !== "Space") return;
      const tag = (ev.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") return;
      ev.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files[0];
    if (!file) return;
    if (mode !== "file") switchMode("file");
    loadFile(file);
  };

  const r = readout.kind === "harmonic" ? readout : null;
  const info = r?.info;
  const showTimeline = mode === "file" && fileName !== null;
  const insetBottom = STRIP_H + (showTimeline ? TIMELINE_H : 0);

  const playButton = (
    <button className={`play ${playing ? "on" : ""}`} onClick={togglePlay} disabled={mode === "file" && !fileName}>
      {mode === "mic" ? (playing ? "Stop" : "Listen") : playing ? "Silence" : "Sound"}
    </button>
  );

  return (
    <main className="app" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <Visualizer
        getFrame={getFrame}
        decay={decay}
        view={view}
        running={playing}
        insetBottom={insetBottom}
        onReadout={setReadout}
      />

      <header className="plate">
        <div className="plate-ratio">
          {info?.p ? (
            <>
              {info.p}
              <span className="ratio-sep">:</span>
              {info.q}
            </>
          ) : r ? (
            <>
              –<span className="ratio-sep">:</span>–
            </>
          ) : (
            " "
          )}
        </div>
        <div className="plate-name">
          {readout.kind === "scope"
            ? "listening · single voice"
            : r
              ? (info?.name ?? (info?.p ? "unnamed ratio" : "no simple ratio"))
              : mode === "file"
                ? fileName
                  ? "paused · space to play"
                  : "drop an audio file"
                : mode === "mic"
                  ? "press listen"
                  : " "}
        </div>
        {r && (
          <div className="plate-sub">
            {info?.p ? `closes after ${info.complexity} cycles` : "never closes"}
            {mode !== "tone" && !playing ? " · paused" : ""}
          </div>
        )}
        {view === "orbit" && <div className="plate-sub">drag to look around · scroll to zoom · double-click to reset</div>}
      </header>

      {showTimeline && (
        <Timeline
          engine={engineRef.current}
          fileVersion={fileVersion}
          readout={readout}
          height={TIMELINE_H}
          bottom={STRIP_H}
        />
      )}

      {mode === "mic" && (
        <FloatingPanel title="Listen" storageKey="harmony.listenPanel" initial={{ right: 32, top: 28 }}>
          <div className="field">
            <span>Source</span>
            <div className="toggle" role="radiogroup" aria-label="Capture source">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={source === s.id}
                  className={source === s.id ? "on" : ""}
                  disabled={s.id === "system"}
                  title={s.hint}
                  onClick={() => s.id !== "system" && switchSource(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Two-voice confidence</span>
            <div className="meter" aria-label="Two-voice confidence">
              <i style={{ width: `${(readout.kind !== "idle" ? readout.confidence : 0) * 100}%` }} />
              <b style={{ left: `${MIN_CONFIDENCE * 100}%` }} />
            </div>
          </div>
          <p className="panel-note">
            {source === "mic"
              ? "Best with a clear sung dyad or two-note chord close to the mic."
              : "Pick the tab in the browser's dialog and tick “share audio”."}
          </p>
          {playButton}
        </FloatingPanel>
      )}

      <footer className="strip" style={{ height: STRIP_H }}>
        <div className="cell brand">Harmony</div>

        <nav className="cell modes" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode ${mode === m.id ? "on" : ""}`}
              aria-pressed={mode === m.id}
              onClick={() => switchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          <Link className="mode" href="/gallery">
            Gallery
          </Link>
        </nav>

        <div className="cell controls" ref={controlsRef}>
          {mode === "tone" && (
            <>
              <Dropdown
                label="Root"
                value={String(rootMidi)}
                options={rootOptions}
                onChange={(v) => setRootMidi(Number(v))}
                layout="grid"
                columns={12}
              />
              <Dropdown label="Interval" value={intervalId} options={intervalOptions} onChange={setIntervalId} />
              <div className="field">
                <span>Tuning</span>
                <div className="toggle">
                  {(["just", "equal"] as const).map((t) => (
                    <button key={t} className={tuning === t ? "on" : ""} onClick={() => setTuning(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>
                  Detune{" "}
                  <span className="num">
                    <Tabular>{signedCents(detune)}</Tabular>
                  </span>
                </span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={0.5}
                  value={detune}
                  onChange={(e) => setDetune(Number(e.target.value))}
                  onDoubleClick={() => setDetune(0)}
                />
              </label>
            </>
          )}

          {mode === "file" && (
            <label className="field file">
              <span>Source</span>
              <span className="file-pick">
                {fileName ?? "choose audio…"}
                <input type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
              </span>
            </label>
          )}

          <label className="field">
            <span>
              Decay{" "}
              <span className="num">
                <Tabular>{decay.toFixed(3)}</Tabular>
              </span>
            </span>
            <input
              type="range"
              min={0.005}
              max={0.25}
              step={0.005}
              value={decay}
              onChange={(e) => setDecay(Number(e.target.value))}
            />
          </label>

          <div className="field">
            <span>View</span>
            <div className="toggle">
              {(["flat", "orbit"] as const).map((v) => (
                <button key={v} className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {mode !== "mic" && playButton}
          <SaveCurve getParams={getSaveParams} suggestTitle={suggestTitle} bottom={insetBottom + 12} />
        </div>

        <dl className="cell readout">
          <div>
            <dt>
              f<sub>1</sub>
            </dt>
            <dd>{r ? <Tabular>{hz(Math.min(r.f1, r.f2))}</Tabular> : "–"}</dd>
          </div>
          <div>
            <dt>
              f<sub>2</sub>
            </dt>
            <dd>{r ? <Tabular>{hz(Math.max(r.f1, r.f2))}</Tabular> : "–"}</dd>
          </div>
          <div>
            <dt>r</dt>
            <dd>{info ? <Tabular>{info.ratio.toFixed(5)}</Tabular> : "–"}</dd>
          </div>
          <div>
            <dt>off</dt>
            <dd>{info?.p ? <Tabular>{signedCents(info.centsError)}</Tabular> : "–"}</dd>
          </div>
        </dl>
      </footer>

      {error && (
        <div className="error" role="alert" style={{ bottom: insetBottom + 18 }}>
          {error}
        </div>
      )}
    </main>
  );
}
