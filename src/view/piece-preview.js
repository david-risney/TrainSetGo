// Renders a small voxel-style preview of a track piece into a canvas, so the build
// palette can show the piece MODEL instead of its name. Browser-only. (FR-039)

import { EDGE_DIRECTIONS } from "../model/hex.js";
import { TrackShape } from "../model/constants.js";
import { connectionPairs } from "../model/track.js";
import { SQUISH } from "./renderer.js";

// Connection rails for a piece at orientation 0, derived from the single source of
// truth in model/track.js. Switches also draw the alternate (unselected) branch faint.
function shapeRails(shape) {
  const rails = connectionPairs(shape, 0, 0);
  const faintPairs = shape === TrackShape.SWITCH ? connectionPairs(shape, 0, 1) : [];
  return { rails, faintPairs };
}

function edgeOffset(edge, scale) {
  const d = EDGE_DIRECTIONS[edge];
  const px = Math.sqrt(3) * (d.q + d.r / 2);
  const py = 1.5 * d.r * SQUISH;
  return { x: px * scale, y: py * scale };
}

function hexCorners(cx, cy, radius) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 90);
    pts.push({ x: cx + radius * Math.cos(ang), y: cy + radius * SQUISH * Math.sin(ang) });
  }
  return pts;
}

// Fixed logical drawing size. Using a constant (not clientWidth) decouples the
// backing store from the displayed size so repeated redraws can never feed back
// into the element's layout and grow it unbounded.
const PREVIEW_SIZE = 48;

export function drawPiecePreview(canvas, shape, size = PREVIEW_SIZE) {
  const ctx = canvas.getContext("2d");
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const w = size;
  const h = size;
  // Pin the CSS display size and the backing-store size independently.
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const radius = Math.min(w, h) * 0.46;
  const height = radius * 0.34;
  const cy = h / 2 + height / 2;

  const grass = { top: "#6fc06a", side: "#4c8f48" };
  const top = hexCorners(cx, cy - height, radius);
  const bottom = hexCorners(cx, cy, radius);

  // Front side walls.
  ctx.fillStyle = grass.side;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(top[i].x, top[i].y);
    ctx.lineTo(top[i + 1].x, top[i + 1].y);
    ctx.lineTo(bottom[i + 1].x, bottom[i + 1].y);
    ctx.lineTo(bottom[i].x, bottom[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // Top face.
  ctx.fillStyle = grass.top;
  ctx.beginPath();
  top.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();

  // Rails on the top face.
  const tcx = cx;
  const tcy = cy - height;
  const railScale = radius;
  const stroke = (a, b, color, lw) => {
    const oa = edgeOffset(a, railScale * 0.5);
    const ob = edgeOffset(b, railScale * 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tcx + oa.x, tcy + oa.y);
    ctx.lineTo(tcx, tcy);
    ctx.lineTo(tcx + ob.x, tcy + ob.y);
    ctx.stroke();
  };
  // Pale "ballast" underlay then a dark rail on top -> high contrast at any size.
  const segment = (a, b, faint = false) => {
    const w0 = Math.max(3, radius * 0.2);
    stroke(a, b, faint ? "rgba(120,120,120,0.5)" : "#e9dcab", w0 + 2.5);
    stroke(a, b, faint ? "rgba(90,90,90,0.6)" : "#23211c", faint ? w0 * 0.6 : w0);
  };

  const { rails, faintPairs } = shapeRails(shape);
  for (const [a, b] of faintPairs ?? []) segment(a, b, true);
  for (const [a, b] of rails) segment(a, b, false);
  // Junction dot for readability.
  ctx.fillStyle = "#23211c";
  ctx.beginPath();
  ctx.arc(tcx, tcy, Math.max(1.6, radius * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
