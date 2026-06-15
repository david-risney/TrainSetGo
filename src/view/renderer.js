// Canvas 2D isometric compositor. Projects axial hexes to a squished iso layout and
// draws terrain/track/stations/trains as voxel-style prisms. Browser-only. (FR-039)

import { EDGE_DIRECTIONS, neighbor, oppositeEdge } from "../model/hex.js";
import { TerrainType, TrainStatus, TrackShape } from "../model/constants.js";
import { connectionPairs, connectsEdge } from "../model/track.js";
import { Camera } from "./camera.js";
import { terrainColor, terrainHeight, themeColor, shadeColor } from "./voxel.js";

const HEX_SIZE = 30; // base scene units (pre-zoom)
// Vertical flatten for the isometric look. Higher = camera looks more "down"
// (more top face visible, less side). (User: "looking slightly more down".)
export const SQUISH = 0.82;

// Pointy-top axial -> flat ground-plane world coordinates (size = HEX_SIZE).
// The isometric vertical flatten (SQUISH) is applied later, at projection time, so it
// composes correctly with camera rotation (rotate-then-squish, matching _hexCorners).
export function hexToWorld(q, r) {
  const px = Math.sqrt(3) * (q + r / 2);
  const py = 1.5 * r;
  return { x: HEX_SIZE * px, y: HEX_SIZE * py };
}

// Flat ground-plane world -> fractional axial, then cube-round to nearest hex.
export function worldToHex(x, y) {
  const px = x / HEX_SIZE;
  const py = y / HEX_SIZE;
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
    this.models = null; // optional ModelStore; set by the app once .vox models load
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

  // Ground-plane world point -> screen. Rotate in the ground plane first, THEN apply the
  // isometric vertical squish. This order is what keeps tile footprints, hex corners, and
  // the depth sort consistent as the camera rotates.
  worldToScreen(w) {
    const o = this._origin();
    const cos = Math.cos(this.camera.rotation);
    const sin = Math.sin(this.camera.rotation);
    const rx = w.x * cos - w.y * sin;
    const ry = w.x * sin + w.y * cos;
    return {
      x: o.x + this.camera.panX + rx * this.camera.zoom,
      y: o.y + this.camera.panY + ry * SQUISH * this.camera.zoom,
    };
  }

  screenToHex(sx, sy) {
    const o = this._origin();
    const rx = (sx - o.x - this.camera.panX) / this.camera.zoom;
    const ry = (sy - o.y - this.camera.panY) / (this.camera.zoom * SQUISH);
    // Inverse-rotate back into the flat ground plane.
    const cos = Math.cos(this.camera.rotation);
    const sin = Math.sin(this.camera.rotation);
    const wx = rx * cos + ry * sin;
    const wy = -rx * sin + ry * cos;
    return worldToHex(wx, wy);
  }

  // Zoom while keeping the world point under (sx, sy) fixed on screen. Accounts for
  // the renderer's drawing origin so the gesture stays centered on the focal point.
  // (User: "Zoom in / out is not centered around the middle point of the two fingers".)
  zoomAt(factor, sx, sy) {
    const o = this._origin();
    const prev = this.camera.zoom;
    const next = this.camera._clampZoom(prev * factor);
    if (next === prev) return;
    // Rotated-ground-plane vector of the anchor (kept constant across the zoom).
    const rx = (sx - o.x - this.camera.panX) / prev;
    const ry = (sy - o.y - this.camera.panY) / (prev * SQUISH);
    this.camera.panX = sx - o.x - rx * next;
    this.camera.panY = sy - o.y - ry * SQUISH * next;
    this.camera.zoom = next;
  }

  // Rotate the camera around the world point under (sx, sy) so pieces stay anchored
  // to the focal point rather than swinging around the screen origin.
  rotateAt(deltaRadians, sx, sy) {
    const o = this._origin();
    // Current rotated-ground-plane coords of the focal point.
    const rx = (sx - o.x - this.camera.panX) / this.camera.zoom;
    const ry = (sy - o.y - this.camera.panY) / (this.camera.zoom * SQUISH);
    const cos = Math.cos(deltaRadians);
    const sin = Math.sin(deltaRadians);
    // Where that same world point lands after the extra rotation.
    const nrx = rx * cos - ry * sin;
    const nry = rx * sin + ry * cos;
    this.camera.panX = sx - o.x - nrx * this.camera.zoom;
    this.camera.panY = sy - o.y - nry * SQUISH * this.camera.zoom;
    this.camera.rotation += deltaRadians;
  }

  // Frame a set of ground-plane world points so they fit centered in the viewport.
  fitWorld(points, { fillX = 0.7, fillY = 0.6, maxZoom = 1.4, pad = HEX_SIZE } = {}) {
    if (!points.length) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    // Frame at rotation 0: x maps at zoom, y maps at zoom*SQUISH.
    const zoom = this.camera._clampZoom(
      Math.min(maxZoom, (this.viewW * fillX) / w, (this.viewH * fillY) / (h * SQUISH)),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const o = this._origin();
    this.camera.rotation = 0;
    this.camera.zoom = zoom;
    this.camera.panX = this.viewW / 2 - o.x - cx * zoom;
    this.camera.panY = this.viewH / 2 - o.y - cy * SQUISH * zoom;
  }

  _hexCorners(cx, cy, radius) {
    const pts = [];
    const rot = this.camera.rotation;
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 90) + rot;
      pts.push({ x: cx + radius * Math.cos(ang), y: cy + radius * SQUISH * Math.sin(ang) });
    }
    return pts;
  }

  // The animated full-screen backdrop is drawn on a separate canvas behind the
  // scene (see view/background.js BackgroundManager). The scene canvas is kept
  // transparent so that animated background shows through the tile gaps.
  render(snapshot, progress = 1, opts = {}) {
    this.lastSnapshot = snapshot;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    if (!snapshot) {
      ctx.restore();
      return;
    }

    // Depth sort using the *projected* screen position so the painter's-order stays
    // correct under camera rotation (User: rotation revealed mis-ordered pieces).
    const radius = HEX_SIZE * this.camera.zoom;
    const stationByKey = new Map(snapshot.stations.map((s) => [`${s.q},${s.r}`, s]));
    const tileByKey = new Map(snapshot.tiles.map((t) => [`${t.q},${t.r}`, t]));
    const placed = snapshot.tiles
      .map((tile) => {
        const w = hexToWorld(tile.q, tile.r);
        const s = this.worldToScreen(w);
        return { tile, w, s };
      })
      .sort((a, b) => a.s.y - b.s.y || a.s.x - b.s.x);

    for (const { tile, s } of placed) {
      const height = terrainHeight(tile.terrain) * this.camera.zoom * SQUISH;
      this._drawPrism(s.x, s.y, radius, height, tile);

      if (tile.track) this._drawTrack(s.x, s.y - height, radius, tile.track);

      const station = stationByKey.get(`${tile.q},${tile.r}`);
      if (station) {
        // Draw the rails that lead into the station, and face the building toward them.
        const edges = this._stationEdges(tile, tileByKey);
        if (edges.length) this._drawStationStub(s.x, s.y - height, radius, edges);
        const facing = edges.length ? this._edgesFacing(edges) : 0;
        this._drawStation(s.x, s.y - height, radius, station.color, facing);
      }
    }

    // Trains on top, interpolated between their previous and current tile. A produced train
    // that has not departed yet (BOARDING) is drawn parked at its source station.
    for (const train of snapshot.trains) {
      if (train.status === TrainStatus.WAITING) continue;
      const w = this._trainWorld(train, progress);
      const s = this.worldToScreen(w);
      this._drawTrain(s.x, s.y - 14 * this.camera.zoom, radius, train, this._trainFacing(train));
    }

    // Station countdowns: a floating timer over stations about to produce a train. (User req)
    for (const c of opts.countdowns ?? []) {
      const s = this.worldToScreen(hexToWorld(c.q, c.r));
      this._drawStationCountdown(s.x, s.y, radius, c.seconds);
    }

    ctx.restore();
  }

  // Floating countdown badge above a station: how many seconds until it produces a train.
  _drawStationCountdown(cx, cy, radius, seconds) {
    const ctx = this.ctx;
    const r = Math.max(11, radius * 0.42);
    const by = cy - radius * 1.7; // hover above the station building
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(24, 30, 48, 0.86)";
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, radius * 0.05);
    ctx.strokeStyle = seconds <= 3 ? "#ff6b6b" : "#ffe08a";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(r * 1.15)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(seconds), cx, by + 1);
    ctx.restore();
  }

  // Edges of a station tile whose neighbor carries track connecting back into the station.
  _stationEdges(tile, tileByKey) {
    const edges = [];
    for (let e = 0; e < 6; e++) {
      const n = neighbor(tile, e);
      const nt = tileByKey.get(`${n.q},${n.r}`);
      if (
        nt &&
        nt.track &&
        connectsEdge(nt.track.shape, nt.track.orientation, nt.track.switchState ?? 0, oppositeEdge(e))
      ) {
        edges.push(e);
      }
    }
    return edges;
  }

  // World-space heading (pre-camera-rotation) that points along a set of edges.
  _edgesFacing(edges) {
    let x = 0;
    let y = 0;
    for (const e of edges) {
      const d = EDGE_DIRECTIONS[e];
      const w = hexToWorld(d.q, d.r);
      x += w.x;
      y += w.y;
    }
    return Math.atan2(y, x);
  }

  // World-space heading of a train (the edge it is moving toward).
  _trainFacing(train) {
    if (train.headingEdge != null) {
      const d = EDGE_DIRECTIONS[train.headingEdge];
      const w = hexToWorld(d.q, d.r);
      return Math.atan2(w.y, w.x);
    }
    return 0;
  }

  // Short rail stubs from the station center toward each connecting edge. (User: "station
  // tiles should show track going to the station".)
  _drawStationStub(cx, cy, radius, edges) {
    const ctx = this.ctx;
    ctx.lineCap = "round";
    const rot = this.camera.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const z = this.camera.zoom;
    const width = Math.max(2, 4 * z);
    ctx.strokeStyle = "#2b2b2b";
    ctx.lineWidth = width;
    for (const e of edges) {
      const d = EDGE_DIRECTIONS[e];
      const w = hexToWorld(d.q, d.r);
      const rx = w.x * cos - w.y * sin;
      const ry = w.x * sin + w.y * cos;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rx * 0.5 * z, cy + ry * SQUISH * 0.5 * z);
      ctx.stroke();
    }
  }

  // Interpolated world position for a moving train (smooths slow tile-to-tile motion).
  _trainWorld(train, progress) {
    if (
      train.status === TrainStatus.RUNNING &&
      train.headingEdge != null &&
      progress < 1
    ) {
      const enterEdge = oppositeEdge(train.headingEdge);
      const prev = neighbor(train.position, enterEdge);
      const a = hexToWorld(prev.q, prev.r);
      const b = hexToWorld(train.position.q, train.position.r);
      return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress };
    }
    return hexToWorld(train.position.q, train.position.r);
  }

  _drawPrism(cx, cy, radius, height, tile) {
    const ctx = this.ctx;
    const colors = terrainColor(tile.terrain);
    const top = this._hexCorners(cx, cy - height, radius);
    const bottom = this._hexCorners(cx, cy, radius);
    const topCenterY = cy - height;

    // Side walls: draw only the faces pointing toward the viewer. A face is front-facing
    // when the midpoint of its top edge sits below the hex center on screen — this picks
    // the correct faces at ANY camera rotation (fixes missing side walls when rotated).
    ctx.fillStyle = colors.side;
    for (let i = 0; i < 6; i++) {
      const a = top[i];
      const b = top[(i + 1) % 6];
      if ((a.y + b.y) / 2 <= topCenterY) continue; // back-facing
      const c = bottom[(i + 1) % 6];
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

    // Slightly darker border around the tile edge for definition. (User request.)
    ctx.strokeStyle = shadeColor(colors.side, 0.7);
    ctx.lineWidth = Math.max(1, this.camera.zoom);
    ctx.lineJoin = "round";
    ctx.stroke();

    // Highlight editable tiles subtly.
    if (tile.lock === "editable" && tile.terrain === TerrainType.GRASS && !tile.track) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawTrack(cx, cy, radius, track) {
    const ctx = this.ctx;
    ctx.lineCap = "round";
    const rot = this.camera.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const edgeOffset = (edge) => {
      const d = EDGE_DIRECTIONS[edge];
      const w = hexToWorld(d.q, d.r);
      const rx = w.x * cos - w.y * sin;
      const ry = w.x * sin + w.y * cos;
      // Rotate in the ground plane, then squish y to match the projected top face.
      return { x: rx * 0.5 * this.camera.zoom, y: ry * SQUISH * 0.5 * this.camera.zoom };
    };
    const segment = (a, b, color, width) => {
      const oa = edgeOffset(a);
      const ob = edgeOffset(b);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx + oa.x, cy + oa.y);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + ob.x, cy + ob.y);
      ctx.stroke();
    };

    const base = Math.max(2, 4 * this.camera.zoom);

    if (track.shape === TrackShape.SWITCH) {
      // Draw the connected (selected) branch dark on top of the faint alternate
      // branch, so the player can see which way the switch is currently set.
      const selected = track.switchState ?? 0;
      const other = selected === 0 ? 1 : 0;
      const [[inbound, selBranch]] = connectionPairs(track.shape, track.orientation, selected);
      const [, otherBranch] = connectionPairs(track.shape, track.orientation, other)[0];
      segment(inbound, otherBranch, "rgba(120,120,120,0.55)", Math.max(1.5, base * 0.7));
      segment(inbound, selBranch, "#2b2b2b", base);
      return;
    }

    for (const [a, b] of connectionPairs(track.shape, track.orientation, track.switchState ?? 0)) {
      segment(a, b, "#2b2b2b", base);
    }
  }

  // Project a model-local offset (forward `fl`, right `sw`, in screen px at current zoom)
  // for a model whose forward axis points along world angle `facing`. Applies camera
  // rotation + iso squish so models turn WITH the board. (User: models didn't rotate.)
  _projForward(facing, fl, sw) {
    const rot = this.camera.rotation;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const cosF = Math.cos(facing);
    const sinF = Math.sin(facing);
    const ox = fl * cosF - sw * sinF;
    const oy = fl * sinF + sw * cosF;
    const rx = ox * cosR - oy * sinR;
    const ry = ox * sinR + oy * cosR;
    return { x: rx, y: ry * SQUISH };
  }

  // Directional rectangular voxel box: footprint is a rotated rectangle (halfLen along the
  // model's forward axis, halfWid across) that rises straight up by `height` px. The front
  // face (toward +forward) can be shaded distinctly (`opts.frontColor`) so the model reads
  // with a clear heading. Walls are drawn back-to-front for correct overlap at any rotation.
  _box(cx, cy, facing, halfLen, halfWid, height, baseColor, opts = {}) {
    const ctx = this.ctx;
    const corner = (fl, sw) => {
      const d = this._projForward(facing, fl, sw);
      return { x: cx + d.x, y: cy + d.y };
    };
    const b = [
      corner(halfLen, halfWid), // front-right
      corner(halfLen, -halfWid), // front-left
      corner(-halfLen, -halfWid), // back-left
      corner(-halfLen, halfWid), // back-right
    ];
    const t = b.map((p) => ({ x: p.x, y: p.y - height }));
    const face = (pts, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
    };
    const walls = [0, 1, 2, 3]
      .map((k) => ({ k, depth: (b[k].y + b[(k + 1) % 4].y) / 2 }))
      .sort((p, q) => p.depth - q.depth);
    for (const { k } of walls) {
      const k1 = (k + 1) % 4;
      const shade = k === 0 ? 0.95 : k === 2 ? 0.55 : 0.72; // front / back / sides
      const color = k === 0 && opts.frontColor ? opts.frontColor : shadeColor(baseColor, shade);
      face([t[k], t[k1], b[k1], b[k]], color);
    }
    face(t, shadeColor(baseColor, 1.15));
  }

  // Draw a normalized .vox model as a stack of unit cubes through the existing iso
  // projection so it rotates WITH the board. Voxels are painter-sorted by their projected
  // footprint depth (then height). With tint "theme" the authored grayscale is recolored by
  // `baseColor` (voxel luminance → shade); otherwise the authored voxel colors are used.
  _drawVoxelModel(cx, cy, radius, facing, model, baseColor) {
    const cell = (radius * model.footprint) / Math.max(1, model.sizeX, model.sizeY);
    const themed = model.tint === "theme";
    const placed = model.voxels
      .map((v) => ({ v, d: this._projForward(facing, v.x * cell, v.y * cell) }))
      .sort((a, b) => a.d.y - b.d.y || a.v.z - b.v.z);
    for (const { v, d } of placed) {
      const color = themed ? shadeColor(baseColor, 0.55 + v.luma * 0.9) : v.color;
      this._box(cx + d.x, cy + d.y - v.z * cell, facing, cell / 2, cell / 2, cell, color);
    }
  }

  // Placeholder voxel "station": a building with a darker door on the track-facing side
  // and a brighter roof cap, oriented toward the connecting track. Uses an authored .vox
  // model when one is loaded, else falls back to the procedural boxes. (FR-039)
  _drawStation(cx, cy, radius, color, facing = 0) {
    const base = themeColor(color);
    const lift = 6 * this.camera.zoom; // sit on top of the tile surface
    const baseY = cy - lift;
    const model = this.models?.get("station");
    if (model) {
      this._drawVoxelModel(cx, cy - model.lift * this.camera.zoom, radius, facing, model, base);
      return;
    }
    const bodyH = radius * 0.5;
    this._box(cx, baseY, facing, radius * 0.34, radius * 0.46, bodyH, base, {
      frontColor: shadeColor(base, 0.45),
    });
    this._box(
      cx,
      baseY - bodyH,
      facing,
      radius * 0.24,
      radius * 0.34,
      radius * 0.2,
      shadeColor(base, 1.3),
    );
  }

  // Placeholder voxel "train": a long body with a bright headlight front, a taller cab to
  // the rear and a chimney near the front — an unambiguous heading. Uses an authored .vox
  // model when one is loaded, else falls back to the procedural boxes. (FR-039)
  _drawTrain(cx, cy, radius, train, facing = 0) {
    let base = themeColor(train.color);
    if (train.status === TrainStatus.LOST) base = "#6b6b6b";
    const model = this.models?.get("train");
    if (model) {
      this._drawVoxelModel(cx, cy - model.lift * this.camera.zoom, radius, facing, model, base);
      return;
    }
    this._box(cx, cy, facing, radius * 0.5, radius * 0.28, radius * 0.3, base, {
      frontColor: shadeColor(base, 1.35),
    });
    const rear = this._projForward(facing, -radius * 0.16, 0);
    this._box(
      cx + rear.x,
      cy + rear.y,
      facing,
      radius * 0.2,
      radius * 0.26,
      radius * 0.34,
      shadeColor(base, 0.8),
    );
    const fore = this._projForward(facing, radius * 0.3, 0);
    this._box(
      cx + fore.x,
      cy + fore.y,
      facing,
      radius * 0.08,
      radius * 0.08,
      radius * 0.3,
      shadeColor(base, 0.5),
    );
  }
}
