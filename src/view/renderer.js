// Canvas 2D isometric compositor. Projects axial hexes to a squished iso layout and
// draws terrain/track/stations/trains as voxel-style prisms. Browser-only. (FR-039)

import { EDGE_DIRECTIONS } from "../model/hex.js";
import { TerrainType, TrainStatus } from "../model/constants.js";
import { Camera } from "./camera.js";
import { terrainColor, terrainHeight, themeColor } from "./voxel.js";

const HEX_SIZE = 30; // base scene units (pre-zoom)
const SQUISH = 0.6; // vertical flatten for the isometric look

// Pointy-top axial -> un-zoomed world coordinates (size = HEX_SIZE).
export function hexToWorld(q, r) {
  const px = Math.sqrt(3) * (q + r / 2);
  const py = 1.5 * r;
  return { x: HEX_SIZE * px, y: HEX_SIZE * py * SQUISH };
}

// World -> fractional axial, then cube-round to nearest hex.
export function worldToHex(x, y) {
  const px = x / HEX_SIZE;
  const py = y / (HEX_SIZE * SQUISH);
  const qf = (Math.sqrt(3) / 3) * px - (1 / 3) * py;
  const rf = (2 / 3) * py;
  return cubeRound(qf, rf);
}

function cubeRound(qf, rf) {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = new Camera();
    this.dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    this.lastSnapshot = null;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || this.canvas.width || 800;
    const h = this.canvas.clientHeight || this.canvas.height || 600;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.viewW = w;
    this.viewH = h;
    if (this.lastSnapshot) this.render(this.lastSnapshot);
  }

  setCamera(camera) {
    this.camera.set(camera);
    if (this.lastSnapshot) this.render(this.lastSnapshot);
  }

  _origin() {
    return { x: this.viewW / 2, y: this.viewH / 3 };
  }

  worldToScreen(w) {
    const o = this._origin();
    return {
      x: o.x + this.camera.panX + w.x * this.camera.zoom,
      y: o.y + this.camera.panY + w.y * this.camera.zoom,
    };
  }

  screenToHex(sx, sy) {
    const o = this._origin();
    const wx = (sx - o.x - this.camera.panX) / this.camera.zoom;
    const wy = (sy - o.y - this.camera.panY) / this.camera.zoom;
    return worldToHex(wx, wy);
  }

  _hexCorners(cx, cy, radius) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 90);
      pts.push({ x: cx + radius * Math.cos(ang), y: cy + radius * SQUISH * Math.sin(ang) });
    }
    return pts;
  }

  render(snapshot) {
    this.lastSnapshot = snapshot;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = "#10151f";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!snapshot) {
      ctx.restore();
      return;
    }

    // Back-to-front: smaller r is further back; tie-break by q.
    const tiles = [...snapshot.tiles].sort((a, b) => a.r - b.r || a.q - b.q);
    const radius = HEX_SIZE * this.camera.zoom;
    const stationByKey = new Map(snapshot.stations.map((s) => [`${s.q},${s.r}`, s]));

    for (const tile of tiles) {
      const w = hexToWorld(tile.q, tile.r);
      const s = this.worldToScreen(w);
      const height = terrainHeight(tile.terrain) * this.camera.zoom * SQUISH;
      this._drawPrism(s.x, s.y, radius, height, tile);

      if (tile.track) this._drawTrack(s.x, s.y - height, radius, tile.track);

      const station = stationByKey.get(`${tile.q},${tile.r}`);
      if (station) this._drawStation(s.x, s.y - height, radius, station.color);
    }

    // Trains on top.
    for (const train of snapshot.trains) {
      if (train.status === TrainStatus.WAITING) continue;
      if (train.status === TrainStatus.LOST || train.status === TrainStatus.COMPLETED) {
        // brief end-state still drawn faintly
      }
      const w = hexToWorld(train.position.q, train.position.r);
      const s = this.worldToScreen(w);
      this._drawTrain(s.x, s.y - 14 * this.camera.zoom, radius, train);
    }

    ctx.restore();
  }

  _drawPrism(cx, cy, radius, height, tile) {
    const ctx = this.ctx;
    const colors = terrainColor(tile.terrain);
    const top = this._hexCorners(cx, cy - height, radius);
    const bottom = this._hexCorners(cx, cy, radius);

    // Side walls (only the front-facing ones, corners 2..5).
    ctx.fillStyle = colors.side;
    for (let i = 1; i <= 3; i++) {
      const a = top[i];
      const b = top[i + 1];
      const c = bottom[i + 1];
      const d = bottom[i];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }

    // Top face.
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    top.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();

    // Highlight editable tiles subtly.
    if (tile.lock === "editable" && tile.terrain === TerrainType.GRASS && !tile.track) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawTrack(cx, cy, radius, track) {
    const ctx = this.ctx;
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = Math.max(2, 4 * this.camera.zoom);
    ctx.lineCap = "round";
    const edgeOffset = (edge) => {
      const d = EDGE_DIRECTIONS[edge];
      const w = hexToWorld(d.q, d.r);
      return { x: (w.x * 0.5) * this.camera.zoom, y: (w.y * 0.5) * this.camera.zoom };
    };
    const pairs = trackPairs(track);
    for (const [a, b] of pairs) {
      const oa = edgeOffset(a);
      const ob = edgeOffset(b);
      ctx.beginPath();
      ctx.moveTo(cx + oa.x, cy + oa.y);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + ob.x, cy + ob.y);
      ctx.stroke();
    }
  }

  _drawStation(cx, cy, radius, color) {
    const ctx = this.ctx;
    const r = radius * 0.4;
    ctx.fillStyle = themeColor(color);
    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cx - r, cy - r - 8 * this.camera.zoom, r * 2, r * 2);
    ctx.fill();
    ctx.stroke();
  }

  _drawTrain(cx, cy, radius, train) {
    const ctx = this.ctx;
    const r = radius * 0.3;
    let fill = themeColor(train.color);
    if (train.status === TrainStatus.LOST) fill = "#555";
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * SQUISH + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Local copy of connection pairs for rendering (mirror of track.js but view-side).
function trackPairs(track) {
  const rot = (e) => (e + track.orientation) % 6;
  switch (track.shape) {
    case "straight":
      return [[rot(0), rot(3)]];
    case "slightCurve":
      return [[rot(0), rot(2)]];
    case "sharpCurve":
      return [[rot(0), rot(1)]];
    case "crossing":
      return [[rot(0), rot(3)], [rot(1), rot(4)]];
    case "switch": {
      const inbound = rot(3);
      const branch = rot((track.switchState ?? 0) === 0 ? 0 : 1);
      return [[inbound, branch]];
    }
    default:
      return [];
  }
}
