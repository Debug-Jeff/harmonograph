import { PitchDetector } from "./PitchDetector";
import { TOLERANCE_CENTS } from "../ratio";

export type Mode = "tone" | "file" | "mic";

export type CaptureSource = "mic" | "tab";

export type Frame =
  | { kind: "harmonic"; f1: number; f2: number; tolerance: number; confidence: number }
  | { kind: "scope"; samples: Float32Array; delay: number; confidence: number };

export const MIN_CONFIDENCE = 0.12;

const TONE_GAIN = 0.12;
const GLIDE = 0.03;

export class AudioEngine {
  readonly ctx: AudioContext;
  private analyser: AnalyserNode;
  private detector: PitchDetector;
  private timeData: Float32Array<ArrayBuffer>;

  private oscs: [OscillatorNode, OscillatorNode] | null = null;
  private toneGain: GainNode | null = null;

  private buffer: AudioBuffer | null = null;
  private fileSource: AudioBufferSourceNode | null = null;
  private fileStartedAt = 0;
  private fileOffset = 0;
  onFileEnded: (() => void) | null = null;

  private captureStream: MediaStream | null = null;
  private captureSource: MediaStreamAudioSourceNode | null = null;
  onCaptureEnded: (() => void) | null = null;

  private smooth: [number, number] | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 16384;
    this.analyser.smoothingTimeConstant = 0.55;
    this.detector = new PitchDetector(this.analyser);
    this.timeData = new Float32Array(2048);
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  playTones(f1: number, f2: number) {
    if (this.oscs) return this.setTones(f1, f2);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ctx.destination);
    const make = (f: number) => {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      return o;
    };
    this.oscs = [make(f1), make(f2)];
    this.toneGain = gain;
    gain.gain.setTargetAtTime(TONE_GAIN, this.ctx.currentTime, 0.04);
  }

  setTones(f1: number, f2: number) {
    if (!this.oscs) return;
    const t = this.ctx.currentTime;
    this.oscs[0].frequency.setTargetAtTime(f1, t, GLIDE);
    this.oscs[1].frequency.setTargetAtTime(f2, t, GLIDE);
  }

  stopTones() {
    if (!this.oscs || !this.toneGain) return;
    const oscs = this.oscs, gain = this.toneGain;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => {
      oscs.forEach((o) => o.stop());
      gain.disconnect();
    }, 300);
    this.oscs = null;
    this.toneGain = null;
  }

  get tonesPlaying() {
    return this.oscs !== null;
  }

  async loadFile(file: File) {
    this.stopFile();
    this.buffer = await this.ctx.decodeAudioData(await file.arrayBuffer());
    this.fileOffset = 0;
    this.smooth = null;
    return this.buffer.duration;
  }

  playFile() {
    if (!this.buffer || this.fileSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    src.onended = () => {
      if (this.fileSource !== src) return;
      this.fileSource = null;
      this.fileOffset = 0;
      this.onFileEnded?.();
    };
    src.start(0, this.fileOffset);
    this.fileStartedAt = this.ctx.currentTime - this.fileOffset;
    this.fileSource = src;
  }

  pauseFile() {
    if (!this.fileSource) return;
    this.fileOffset = this.ctx.currentTime - this.fileStartedAt;
    this.stopFile();
  }

  seekFile(seconds: number) {
    if (!this.buffer) return;
    const wasPlaying = this.filePlaying;
    this.stopFile();
    this.fileOffset = Math.max(0, Math.min(seconds, this.buffer.duration - 0.01));
    this.smooth = null;
    if (wasPlaying) this.playFile();
  }

  private stopFile() {
    const src = this.fileSource;
    this.fileSource = null;
    if (src) {
      src.stop();
      src.disconnect();
    }
    try {
      this.analyser.disconnect(this.ctx.destination);
    } catch {
    }
  }

  get filePlaying() {
    return this.fileSource !== null;
  }

  get hasFile() {
    return this.buffer !== null;
  }

  get fileDuration() {
    return this.buffer?.duration ?? 0;
  }

  get fileTime() {
    return this.fileSource ? this.ctx.currentTime - this.fileStartedAt : this.fileOffset;
  }

  filePeaks(columns: number): Float32Array {
    const out = new Float32Array(columns * 2);
    const buf = this.buffer;
    if (!buf || columns <= 0) return out;
    const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
    const per = buf.length / columns;
    for (let col = 0; col < columns; col++) {
      const start = Math.floor(col * per);
      const end = Math.min(buf.length, Math.floor((col + 1) * per));
      let min = 0, max = 0;
      for (let i = start; i < end; i++) {
        let v = 0;
        for (const ch of chans) v += ch[i];
        v /= chans.length;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      out[col * 2] = min;
      out[col * 2 + 1] = max;
    }
    return out;
  }

  async startCapture(source: CaptureSource) {
    if (this.captureStream) return;
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    let stream: MediaStream;
    if (source === "mic") {
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } else {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio,
        systemAudio: "include",
        selfBrowserSurface: "exclude",
      } as DisplayMediaStreamOptions);
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("No audio was shared — tick “share audio” in the browser's picker.");
      }
      stream.getVideoTracks().forEach((t) => (t.enabled = false));
    }
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      if (this.captureStream !== stream) return;
      this.stopCapture();
      this.onCaptureEnded?.();
    });
    this.captureStream = stream;
    this.captureSource = this.ctx.createMediaStreamSource(stream);
    this.captureSource.connect(this.analyser);
    this.smooth = null;
  }

  stopCapture() {
    this.captureSource?.disconnect();
    this.captureStream?.getTracks().forEach((t) => t.stop());
    this.captureSource = null;
    this.captureStream = null;
  }

  get captureActive() {
    return this.captureStream !== null;
  }

  stopAll() {
    this.stopTones();
    this.pauseFile();
    this.stopCapture();
  }

  readDetectedFrame(): Frame | null {
    if (!this.fileSource && !this.captureSource) return null;

    const { voices, confidence } = this.detector.detect();
    if (voices.length === 0) {
      this.smooth = null;
      return null;
    }

    if (voices.length < 2 || confidence < MIN_CONFIDENCE) {
      this.analyser.getFloatTimeDomainData(this.timeData);
      const delay = Math.max(2, Math.round(this.ctx.sampleRate / voices[0].freq / 4));
      return { kind: "scope", samples: this.timeData, delay, confidence };
    }

    const lo = Math.min(voices[0].freq, voices[1].freq);
    const hi = Math.max(voices[0].freq, voices[1].freq);
    this.smooth = this.smoothVoices(lo, hi);
    return {
      kind: "harmonic",
      f1: this.smooth[0],
      f2: this.smooth[1],
      tolerance: TOLERANCE_CENTS.detected,
      confidence,
    };
  }

  private smoothVoices(lo: number, hi: number): [number, number] {
    const prev = this.smooth;
    if (!prev) return [lo, hi];
    const ema = (old: number, next: number) => {
      const jump = Math.abs(1200 * Math.log2(next / old));
      if (jump > 60) return next;
      return Math.exp(Math.log(old) * 0.7 + Math.log(next) * 0.3);
    };
    return [ema(prev[0], lo), ema(prev[1], hi)];
  }
}
