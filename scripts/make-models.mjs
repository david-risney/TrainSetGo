// Dev tool: generate starter MagicaVoxel ".vox" models for the train and station so the
// voxel pipeline ships with editable assets. Open the output in Goxel / MagicaVoxel to
// reshape them. Models are authored in grayscale (the game recolors them per theme) with
// +X = forward/heading, +Y = right, +Z = up. Run: node scripts/make-models.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "models");

// Shared grayscale palette (color index -> [r,g,b]). Luminance drives the in-game shade.
const PAL = {
  1: [0xb0, 0xb0, 0xb0], // body / walls (mid)
  2: [0x8a, 0x8a, 0x8a], // cab (darker)
  3: [0x3a, 0x3a, 0x3a], // detail: chimney / door / wheels (dark)
  4: [0xf2, 0xf2, 0xf2], // nose / headlight (bright -> reads as heading)
  5: [0xd6, 0xd6, 0xd6], // roof (light)
};

function box(out, x0, x1, y0, y1, z0, z1, c) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) out.push({ x, y, z, c });
}

function train() {
  const v = [];
  box(v, 1, 8, 1, 3, 1, 2, 1); // body
  box(v, 1, 3, 1, 3, 3, 4, 2); // rear cab (taller)
  box(v, 6, 6, 2, 2, 3, 4, 3); // chimney near the front
  box(v, 9, 9, 1, 3, 1, 2, 4); // bright nose (front, +X)
  for (const x of [2, 4, 7]) for (const y of [1, 3]) v.push({ x, y, z: 0, c: 3 }); // wheels
  return { size: [10, 5, 5], voxels: v };
}

function station() {
  const v = [];
  box(v, 0, 5, 0, 5, 0, 3, 1); // walls (interior voxels are culled at load)
  box(v, 1, 4, 1, 4, 4, 4, 5); // roof cap
  box(v, 2, 3, 2, 3, 5, 5, 5); // roof peak
  box(v, 5, 5, 2, 3, 0, 1, 3); // door on the track-facing (+X) wall
  return { size: [6, 6, 6], voxels: v };
}

function encodeVox(size, voxels) {
  const chunk = (id, content) => {
    const head = Buffer.alloc(12);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(content.length, 4);
    head.writeUInt32LE(0, 8);
    return Buffer.concat([head, content]);
  };

  const sizeBuf = Buffer.alloc(12);
  sizeBuf.writeUInt32LE(size[0], 0);
  sizeBuf.writeUInt32LE(size[1], 4);
  sizeBuf.writeUInt32LE(size[2], 8);

  const xyzi = Buffer.alloc(4 + voxels.length * 4);
  xyzi.writeUInt32LE(voxels.length, 0);
  voxels.forEach((vx, i) => {
    const p = 4 + i * 4;
    xyzi[p] = vx.x;
    xyzi[p + 1] = vx.y;
    xyzi[p + 2] = vx.z;
    xyzi[p + 3] = vx.c;
  });

  // RGBA: entry i (0-based) is the color for voxel index i+1.
  const rgba = Buffer.alloc(256 * 4);
  for (const [c, [r, g, b]] of Object.entries(PAL)) {
    const p = (Number(c) - 1) * 4;
    rgba[p] = r;
    rgba[p + 1] = g;
    rgba[p + 2] = b;
    rgba[p + 3] = 255;
  }

  const children = Buffer.concat([
    chunk("SIZE", sizeBuf),
    chunk("XYZI", xyzi),
    chunk("RGBA", rgba),
  ]);
  const header = Buffer.alloc(8);
  header.write("VOX ", 0, "ascii");
  header.writeUInt32LE(150, 4);
  // MAIN: empty content, with childrenSize set so external editors can parse it too.
  const main = Buffer.alloc(12);
  main.write("MAIN", 0, "ascii");
  main.writeUInt32LE(0, 4);
  main.writeUInt32LE(children.length, 8);
  return Buffer.concat([header, main, children]);
}

mkdirSync(OUT, { recursive: true });
const t = train();
const s = station();
writeFileSync(join(OUT, "train.vox"), encodeVox(t.size, t.voxels));
writeFileSync(join(OUT, "station.vox"), encodeVox(s.size, s.voxels));
console.log(`Wrote train.vox (${t.voxels.length} voxels) and station.vox (${s.voxels.length} voxels) to ${OUT}`);
