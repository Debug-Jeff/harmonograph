import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  GHOST,
  GOLD,
  curveAlpha,
  curveColor,
  curveSpan,
  type CurveRenderer,
  type CurveStyle,
  type HarmonicParams,
} from "./curve";

const MAX_POINTS = 60_000;
const SCOPE_POINTS = 4096;
const AXIS = 1.55;

const AXIS_LABELS: Array<{ at: [number, number, number]; text: string }> = [
  { at: [AXIS + 0.12, 0, 0], text: "x · lower note" },
  { at: [0, AXIS + 0.12, 0], text: "y · upper note" },
  { at: [0, 0, AXIS + 0.12], text: "z · difference tone" },
];

const color3 = (c: number[]) => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);

function discTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.72, "#fff");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  return tex;
}

export class OrbitRenderer implements CurveRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  private controls: OrbitControls;

  private curveGeo = new THREE.BufferGeometry();
  private curvePos = new Float32Array(MAX_POINTS * 3);
  private curveCol = new Float32Array(MAX_POINTS * 3);
  private curve: THREE.Line;

  private scopeGeo = new THREE.BufferGeometry();
  private scopePos = new Float32Array(SCOPE_POINTS * 3);
  private scope: THREE.Line;

  private pen: THREE.Points;
  private penMat: THREE.PointsMaterial;
  private disc = discTexture();

  private labels: HTMLElement[] = [];
  private cssW = 0;
  private cssH = 0;
  private readonly scratch = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.camera.up.set(0, 1, 0);
    this.camera.position.set(4.9, 2.6, 6.3);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.6;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.02;
    this.controls.maxPolarAngle = Math.PI - 0.02;
    canvas.addEventListener("dblclick", this.resetView);

    const host = canvas.parentElement;
    if (host) {
      this.labels = AXIS_LABELS.map(({ text }) => {
        const el = document.createElement("span");
        el.className = "axis-label";
        el.textContent = text;
        el.setAttribute("aria-hidden", "true");
        host.appendChild(el);
        return el;
      });
    }

    const additive = {
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    } as const;

    this.curveGeo.setAttribute("position", new THREE.BufferAttribute(this.curvePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.curveGeo.setAttribute("color", new THREE.BufferAttribute(this.curveCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.curve = new THREE.Line(this.curveGeo, new THREE.LineBasicMaterial({ vertexColors: true, ...additive }));
    this.curve.frustumCulled = false;
    this.scene.add(this.curve);

    this.scopeGeo.setAttribute("position", new THREE.BufferAttribute(this.scopePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.scope = new THREE.Line(
      this.scopeGeo,
      new THREE.LineBasicMaterial({ color: color3(GHOST), opacity: 0.45, ...additive }),
    );
    this.scope.frustumCulled = false;
    this.scene.add(this.scope);

    this.penMat = new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: this.disc, ...additive });
    const penGeo = new THREE.BufferGeometry();
    penGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    this.pen = new THREE.Points(penGeo, this.penMat);
    this.scene.add(this.pen);

    this.scene.add(this.buildFittings());
  }

  private buildFittings() {
    const group = new THREE.Group();
    const geo = (pts: number[]) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = (c: number[], opacity: number) => new THREE.LineBasicMaterial({ color: color3(c), opacity, transparent: true });
    const points = (pts: number[], c: number[], size: number, opacity: number) =>
      new THREE.Points(
        geo(pts),
        new THREE.PointsMaterial({ color: color3(c), size, sizeAttenuation: false, opacity, transparent: true, map: this.disc, depthWrite: false }),
      );

    const A = AXIS;
    group.add(new THREE.LineSegments(geo([-A, 0, 0, A, 0, 0, 0, -A, 0, 0, A, 0, 0, 0, -A, 0, 0, A]), mat(GOLD, 0.5)));
    const ticks: number[] = [];
    for (let i = -12; i <= 12; i++) {
      if (i === 0) continue;
      const o = i / 8;
      const l = i % 4 === 0 ? 0.07 : 0.03;
      ticks.push(o, -l, 0, o, l, 0);
      ticks.push(-l, o, 0, l, o, 0);
      ticks.push(0, -l, o, 0, l, o);
    }
    group.add(new THREE.LineSegments(geo(ticks), mat(GOLD, 0.32)));
    group.add(points([A, 0, 0, -A, 0, 0, 0, A, 0, 0, -A, 0, 0, 0, A, 0, 0, -A], GOLD, 7, 0.75));
    group.add(points([0, 0, 0], GOLD, 5, 0.85));

    const ring: number[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      ring.push(Math.cos(a), Math.sin(a), 0);
    }
    group.add(new THREE.Line(geo(ring), mat(GOLD, 0.22)));
    const dots: number[] = [];
    for (let k = 2; k <= 7; k++) {
      const rr = k / 8;
      const count = Math.round(40 * rr) + 24;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.push(rr * Math.cos(a), rr * Math.sin(a), 0);
      }
    }
    group.add(points(dots, GOLD, 2, 0.25));

    const edges: number[] = [];
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        edges.push(-1, a, b, 1, a, b);
        edges.push(a, -1, b, a, 1, b);
        edges.push(a, b, -1, a, b, 1);
      }
    }
    const cube = new THREE.LineSegments(
      geo(edges),
      new THREE.LineDashedMaterial({ color: color3(GHOST), opacity: 0.12, transparent: true, dashSize: 0.05, gapSize: 0.07 }),
    );
    cube.computeLineDistances();
    group.add(cube);
    return group;
  }

  resize(cssW: number, cssH: number, dpr: number, insetBottom: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
    const fullH = cssH + insetBottom;
    this.camera.aspect = cssW / fullH;
    this.camera.setViewOffset(cssW, fullH, 0, insetBottom, cssW, cssH);
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.curve.visible = false;
    this.scope.visible = false;
    this.pen.visible = false;
  }

  drawHarmonic(params: HarmonicParams, style: CurveStyle) {
    const span = curveSpan(params, style, MAX_POINTS);
    if (!span) return;
    const { n, dt, r, decayPerRad } = span;
    const { phase1, phase2 } = params;
    const c = curveColor(style.complexityT);
    const cr = c[0] / 255, cg = c[1] / 255, cb = c[2] / 255;

    const count = Math.min(n + 1, MAX_POINTS);
    const pos = this.curvePos, col = this.curveCol;
    for (let i = 0; i < count; i++) {
      const t = i * dt;
      const env = Math.exp(-decayPerRad * t);
      const j = i * 3;
      pos[j] = env * Math.sin(t + phase1);
      pos[j + 1] = env * Math.sin(r * t + phase2);
      pos[j + 2] = env * Math.cos((r - 1) * t + phase2 - phase1);
      const a = curveAlpha(env);
      col[j] = cr * a;
      col[j + 1] = cg * a;
      col[j + 2] = cb * a;
    }
    this.curveGeo.setDrawRange(0, count);
    this.curveGeo.attributes.position.needsUpdate = true;
    this.curveGeo.attributes.color.needsUpdate = true;
    this.curve.visible = true;

    const penPos = this.pen.geometry.attributes.position as THREE.BufferAttribute;
    penPos.setXYZ(0, Math.sin(phase1), Math.sin(phase2), Math.cos(phase2 - phase1));
    penPos.needsUpdate = true;
    this.penMat.color.setRGB(cr, cg, cb);
    this.pen.visible = true;
  }

  drawScope(samples: Float32Array, delay: number) {
    let peak = 1e-4;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const count = Math.min(samples.length - delay, SCOPE_POINTS);
    for (let i = 0; i < count; i++) {
      this.scopePos[i * 3] = samples[i + delay] / peak;
      this.scopePos[i * 3 + 1] = samples[i] / peak;
      this.scopePos[i * 3 + 2] = 0;
    }
    this.scopeGeo.setDrawRange(0, count);
    this.scopeGeo.attributes.position.needsUpdate = true;
    this.scope.visible = true;
  }

  present() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  private placeLabels() {
    const o = this.scratch.set(0, 0, 0).project(this.camera);
    const ox = ((o.x + 1) / 2) * this.cssW;
    const oy = ((1 - o.y) / 2) * this.cssH;
    this.labels.forEach((el, i) => {
      const [x, y, z] = AXIS_LABELS[i].at;
      const p = this.scratch.set(x, y, z).project(this.camera);
      const sx = ((p.x + 1) / 2) * this.cssW;
      const sy = ((1 - p.y) / 2) * this.cssH;
      const fromOrigin = Math.hypot(sx - ox, sy - oy);
      el.style.opacity = p.z < 1 && fromOrigin > 60 ? "" : "0";
      el.style.transform = "translate(" + sx + "px, " + sy + "px) translate(-50%, -50%)";
    });
  }

  private resetView = () => this.controls.reset();

  dispose() {
    this.labels.forEach((el) => el.remove());
    this.renderer.domElement.removeEventListener("dblclick", this.resetView);
    this.disc.dispose();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Line || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
