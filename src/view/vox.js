// MagicaVoxel ".vox" parser + normalization for the isometric voxel renderer.
// Pure (operates on an ArrayBuffer/DataView) so it is unit-testable in Node.
// Format reference: https://github.com/ept/voxlap/blob/master/MagicaVoxel-file-format-vox.txt
//
// We read the first model's SIZE + XYZI chunks and an optional RGBA palette chunk.
// Voxel color indices are 1..255; per the spec the RGBA chunk entry i (0-based) maps to
// color index i+1, so palette[c] = rgba[c-1]. When a file omits its palette we fall back
// to a neutral grayscale ramp (real editor exports always include an RGBA chunk).

function fourCC(view, off) {
  return String.fromCharCode(
    view.getUint8(off),
    view.getUint8(off + 1),
    view.getUint8(off + 2),
    view.getUint8(off + 3),
  );
}

function toHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Neutral grayscale fallback palette indexed by color index (1..255).
function grayscalePalette() {
  const p = new Array(256).fill("#cccccc");
  for (let i = 1; i < 256; i++) {
    const v = Math.round((i / 255) * 255);
    p[i] = toHex(v, v, v);
  }
  return p;
}

// Parse a .vox ArrayBuffer into { size, voxels, palette }.
//   size:   { x, y, z }
//   voxels: [{ x, y, z, c }]  (c is the 1..255 color index)
//   palette: 256-length array of "#rrggbb" indexed by color index (palette[c])
export function parseVox(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || fourCC(view, 0) !== "VOX ") {
    throw new Error("Not a VOX file");
  }
  let off = 8; // skip "VOX " + version
  let size = { x: 0, y: 0, z: 0 };
  let voxels = [];
  let rgba = null;

  // Walk every chunk; MAIN's content is empty and its children follow inline, so a flat
  // linear scan over the remaining bytes visits SIZE / XYZI / RGBA regardless of nesting.
  while (off + 12 <= buffer.byteLength) {
    const id = fourCC(view, off);
    const contentSize = view.getUint32(off + 4, true);
    off += 12; // id + contentSize + childrenSize
    const content = off;
    if (id === "SIZE") {
      size = {
        x: view.getUint32(content, true),
        y: view.getUint32(content + 4, true),
        z: view.getUint32(content + 8, true),
      };
    } else if (id === "XYZI") {
      const n = view.getUint32(content, true);
      voxels = [];
      for (let i = 0; i < n; i++) {
        const p = content + 4 + i * 4;
        voxels.push({
          x: view.getUint8(p),
          y: view.getUint8(p + 1),
          z: view.getUint8(p + 2),
          c: view.getUint8(p + 3),
        });
      }
    } else if (id === "RGBA") {
      rgba = new Array(256).fill("#cccccc");
      for (let i = 0; i < 256; i++) {
        const p = content + i * 4;
        // rgba[i] is the color for voxel index i+1.
        if (i + 1 < 256) {
          rgba[i + 1] = toHex(view.getUint8(p), view.getUint8(p + 1), view.getUint8(p + 2));
        }
      }
    }
    // MAIN has contentSize 0; advancing by contentSize lets us fall into its children.
    off += contentSize;
  }

  return { size, voxels, palette: rgba ?? grayscalePalette() };
}

// Relative 0.299/0.587/0.114 luminance of a "#rrggbb" color in 0..1.
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0.7;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Normalize a parsed .vox into a render-ready model:
//   - Resolve each voxel's color from the palette and precompute its luminance.
//   - Drop fully-enclosed voxels (all 6 face-neighbors present): they are never visible,
//     which keeps the per-frame cube count small for solid models.
//   - Center the footprint on (0,0); z starts at the model floor (0).
// Returns { sizeX, sizeY, sizeZ, voxels: [{ x, y, z, color, luma }] } where x/y/z are
// integer cell coordinates centered on the footprint (x = forward, y = right, z = up).
export function normalizeModel(parsed) {
  const { size, voxels, palette } = parsed;
  const occupied = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
  const enclosed = (v) =>
    occupied.has(`${v.x + 1},${v.y},${v.z}`) &&
    occupied.has(`${v.x - 1},${v.y},${v.z}`) &&
    occupied.has(`${v.x},${v.y + 1},${v.z}`) &&
    occupied.has(`${v.x},${v.y - 1},${v.z}`) &&
    occupied.has(`${v.x},${v.y},${v.z + 1}`) &&
    occupied.has(`${v.x},${v.y},${v.z - 1}`);

  const cx = (size.x - 1) / 2;
  const cy = (size.y - 1) / 2;
  const out = [];
  for (const v of voxels) {
    if (enclosed(v)) continue;
    const color = palette[v.c] ?? "#cccccc";
    out.push({ x: v.x - cx, y: v.y - cy, z: v.z, color, luma: luminance(color) });
  }
  return { sizeX: size.x, sizeY: size.y, sizeZ: size.z, voxels: out };
}
