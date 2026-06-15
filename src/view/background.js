// Animated, full-screen EarthBound-style backdrops drawn on a dedicated canvas
// behind the scene. Each preset fully (opaquely) paints the canvas, which lets the
// manager crossfade between two presets by painting prev then current at a ramped
// alpha. Browser-only; its own RAF loop runs independently of the scene renderer so
// menu screens (which only re-render on input) still animate. (FR-039)

// Registry exposed for the settings selector. Keep ids stable: they are persisted in
// the save file (settings.menuBackground) and referenced from level data.
export const BACKGROUNDS = [
  { id: "sunny-rails", name: "Sunny Rails" },
  { id: "plasma", name: "Dreamy Plasma" },
  { id: "waves", name: "Candy Waves" },
  { id: "rings", name: "Pulse Rings" },
  { id: "checker-warp", name: "Warp Checker" },
  { id: "kaleido", name: "Pinwheel" },
];

export const DEFAULT_BACKGROUND = "sunny-rails";

const TRANSITION_MS = 1200;

// Smoothstep easing so the crossfade ramps in/out gently (more perceptible than linear).
function easeInOut(p) {
  return p * p * (3 - 2 * p);
}

function hsl(h, s, l) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}

// --- Presets: draw(ctx, w, h, t) where t is seconds. Each must fully paint w×h. ---

// Animated version of the original striped "Sunny Rails" backdrop: warm yellow with
// slowly scrolling diagonal stripes and a soft top glow.
function drawSunnyRails(ctx, w, h, t) {
  ctx.fillStyle = "#fbf3c9";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#f6e9a8";
  const diag = Math.ceil(Math.hypot(w, h));
  const period = 44;
  const band = 22;
  const shift = (t * 18) % period;
  for (let x = -diag + shift; x < diag; x += period) {
    ctx.fillRect(x, -diag, band, diag * 2);
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.22, 0, w * 0.5, h * 0.22, Math.hypot(w, h) * 0.6);
  glow.addColorStop(0, "#fff6c0");
  glow.addColorStop(1, "rgba(255,246,192,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// Coarse-cell sine plasma in a single dreamy purple/indigo theme (lightness varies,
// hue stays within a narrow violet band).
function drawPlasma(ctx, w, h, t) {
  const H = 262;
  const S = 58;
  ctx.fillStyle = hsl(H, S, 16);
  ctx.fillRect(0, 0, w, h);
  const cell = 22;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const v =
        Math.sin(x * 0.018 + t * 1.1) +
        Math.sin(y * 0.026 - t * 0.9) +
        Math.sin((x + y) * 0.015 + t * 0.7) +
        Math.sin(Math.hypot(x - w / 2, y - h / 2) * 0.02 - t);
      const n = v / 4; // ~ -1..1
      const l = 34 + (n * 0.5 + 0.5) * 32; // 34..66
      ctx.fillStyle = hsl(H + n * 12, S, l);
      ctx.fillRect(x, y, cell + 1, cell + 1);
    }
  }
}

// Horizontal candy bands in a single pink/magenta theme that scroll and gently warp.
function drawWaves(ctx, w, h, t) {
  const H = 330;
  const S = 68;
  ctx.fillStyle = hsl(H, S, 24);
  ctx.fillRect(0, 0, w, h);
  const cell = 14;
  for (let y = 0; y < h; y += cell) {
    const l = 50 + Math.sin(y * 0.12 + t * 2) * 16; // 34..66
    ctx.fillStyle = hsl(H + Math.sin(y * 0.05 + t) * 10, S, l);
    const xoff = Math.sin(y * 0.03 + t) * 12;
    ctx.fillRect(xoff - 16, y, w + 32, cell + 1);
  }
}

// Concentric pulsing rings in a single teal/green theme.
function drawRings(ctx, w, h, t) {
  const H = 172;
  const S = 52;
  const cx = w / 2;
  const cy = h / 2;
  const max = Math.hypot(w, h) / 2 + 40;
  const step = 34;
  const pulse = (t * 50) % step;
  ctx.fillStyle = hsl(H, S, 18);
  ctx.fillRect(0, 0, w, h);
  for (let r = max; r > 0; r -= step) {
    const rr = r - pulse;
    if (rr <= 0) continue;
    const l = 36 + Math.sin(rr * 0.05 - t * 2) * 16;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = hsl(H, S, l);
    ctx.fill();
  }
}

// Rotating, wobbling checkerboard in a single orange/amber theme.
function drawCheckerWarp(ctx, w, h, t) {
  const H = 26;
  const S = 70;
  const tile = 46;
  ctx.fillStyle = hsl(H, S, 22);
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.sin(t * 0.2) * 0.22);
  ctx.translate(-w / 2, -h / 2);
  const a = hsl(H, S, 58);
  const b = hsl(H + 14, S, 40);
  for (let y = -tile; y < h + tile; y += tile) {
    const wob = Math.sin(y * 0.05 + t * 1.5) * tile;
    for (let x = -tile; x < w + tile; x += tile) {
      const on = (Math.floor((x + wob) / tile) + Math.floor(y / tile)) % 2 === 0;
      ctx.fillStyle = on ? a : b;
      ctx.fillRect(x + wob, y, tile + 1, tile + 1);
    }
  }
  ctx.restore();
}

// Rotating pinwheel of wedges in a single blue/cyan theme (alternating light/dark).
function drawKaleido(ctx, w, h, t) {
  const H = 206;
  const S = 64;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.hypot(w, h);
  const n = 16;
  ctx.fillStyle = hsl(H, S, 20);
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.22);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = hsl(H + (i % 2 ? 16 : -8), S, i % 2 ? 60 : 44);
    ctx.fill();
  }
  ctx.restore();
}

const PRESETS = {
  "sunny-rails": drawSunnyRails,
  plasma: drawPlasma,
  waves: drawWaves,
  rings: drawRings,
  "checker-warp": drawCheckerWarp,
  kaleido: drawKaleido,
};

export function isBackgroundId(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PRESETS, id);
}

export class BackgroundManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    this.currentId = DEFAULT_BACKGROUND;
    this.prevId = null;
    this.transitionStart = 0;
    this.transitioning = false;
    this.start0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    this._raf = null;
    this._loop = this._loop.bind(this);
    this.reduced =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    if (typeof document !== "undefined") {
      this._onVis = () => {
        if (!document.hidden) this._kick();
        else this._stopRaf();
      };
      document.addEventListener("visibilitychange", this._onVis);
    }
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const w = this.canvas.clientWidth || this.canvas.width || 800;
    const h = this.canvas.clientHeight || this.canvas.height || 600;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.viewW = w;
    this.viewH = h;
    this._drawFrame(this._now());
  }

  start() {
    this._kick();
  }

  stop() {
    this._stopRaf();
    if (typeof document !== "undefined" && this._onVis) {
      document.removeEventListener("visibilitychange", this._onVis);
    }
  }

  // Switch to a new background. Crossfades unless transition is disabled or reduced motion.
  setBackground(id, { transition = true } = {}) {
    if (!isBackgroundId(id)) id = DEFAULT_BACKGROUND;
    if (id === this.currentId && !this.transitioning) return;
    if (transition && !this.reduced && this.currentId) {
      this.prevId = this.currentId;
      this.transitionStart = this._now();
      this.transitioning = true;
    } else {
      this.prevId = null;
      this.transitioning = false;
    }
    this.currentId = id;
    this._kick();
  }

  _now() {
    const t = typeof performance !== "undefined" ? performance.now() : Date.now();
    return t - this.start0;
  }

  _stopRaf() {
    if (this._raf != null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this._raf);
    }
    this._raf = null;
  }

  _kick() {
    if (this._raf != null) return;
    if (typeof requestAnimationFrame === "undefined") {
      this._drawFrame(this._now());
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  _loop() {
    this._raf = null;
    const now = this._now();
    this._drawFrame(now);
    const hidden = typeof document !== "undefined" && document.hidden;
    // Keep animating unless reduced motion (then only run while a crossfade is active).
    if (!hidden && (!this.reduced || this.transitioning)) {
      this._kick();
    }
  }

  _drawFrame(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.viewW;
    const h = this.viewH;
    const t = this.reduced ? 0 : now / 1000;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    let p = 1;
    if (this.transitioning) {
      const raw = Math.min(1, (now - this.transitionStart) / TRANSITION_MS);
      p = easeInOut(raw);
      const prev = PRESETS[this.prevId];
      if (prev) {
        ctx.globalAlpha = 1;
        prev(ctx, w, h, t);
      }
      if (raw >= 1) {
        this.transitioning = false;
        this.prevId = null;
      }
    }
    const cur = PRESETS[this.currentId] || PRESETS[DEFAULT_BACKGROUND];
    ctx.globalAlpha = this.transitioning ? p : 1;
    cur(ctx, w, h, t);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
