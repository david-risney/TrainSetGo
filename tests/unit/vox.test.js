import test from "node:test";
import assert from "node:assert/strict";
import { parseVox, normalizeModel, luminance } from "../../src/view/vox.js";

// Build a minimal valid .vox in memory: a sizeX×sizeY×sizeZ solid block of color index 1,
// plus an RGBA palette where index 1 is the given [r,g,b].
function buildVox(sx, sy, sz, rgb) {
  const voxels = [];
  for (let x = 0; x < sx; x++)
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z++) voxels.push({ x, y, z, c: 1 });

  const chunk = (id, content) => {
    const head = Buffer.alloc(12);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(content.length, 4);
    return Buffer.concat([head, content]);
  };
  const size = Buffer.alloc(12);
  size.writeUInt32LE(sx, 0);
  size.writeUInt32LE(sy, 4);
  size.writeUInt32LE(sz, 8);
  const xyzi = Buffer.alloc(4 + voxels.length * 4);
  xyzi.writeUInt32LE(voxels.length, 0);
  voxels.forEach((v, i) => {
    const p = 4 + i * 4;
    xyzi[p] = v.x;
    xyzi[p + 1] = v.y;
    xyzi[p + 2] = v.z;
    xyzi[p + 3] = v.c;
  });
  const rgba = Buffer.alloc(256 * 4);
  rgba[0] = rgb[0]; // index i=0 -> voxel color index 1
  rgba[1] = rgb[1];
  rgba[2] = rgb[2];
  rgba[3] = 255;
  const children = Buffer.concat([chunk("SIZE", size), chunk("XYZI", xyzi), chunk("RGBA", rgba)]);
  const header = Buffer.alloc(8);
  header.write("VOX ", 0, "ascii");
  header.writeUInt32LE(150, 4);
  const main = Buffer.alloc(12);
  main.write("MAIN", 0, "ascii");
  main.writeUInt32LE(children.length, 8);
  const buf = Buffer.concat([header, main, children]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test("parseVox reads size, voxels and palette colors", () => {
  const parsed = parseVox(buildVox(2, 1, 1, [0xff, 0x00, 0x00]));
  assert.deepEqual(parsed.size, { x: 2, y: 1, z: 1 });
  assert.equal(parsed.voxels.length, 2);
  assert.equal(parsed.palette[1], "#ff0000"); // voxel index 1 -> rgba[0]
});

test("parseVox rejects non-VOX data", () => {
  assert.throws(() => parseVox(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer));
});

test("normalizeModel centers the footprint and resolves colors", () => {
  const model = normalizeModel(parseVox(buildVox(3, 3, 1, [0x00, 0xff, 0x00])));
  assert.equal(model.sizeX, 3);
  // x/y centered: a 3-wide axis centers on 0, so coords run -1..1.
  const xs = model.voxels.map((v) => v.x);
  assert.ok(Math.min(...xs) === -1 && Math.max(...xs) === 1);
  assert.equal(model.voxels[0].color, "#00ff00");
});

test("normalizeModel culls fully-enclosed voxels", () => {
  // A solid 3×3×3 block has exactly one interior voxel (1,1,1) with all 6 neighbors.
  const model = normalizeModel(parseVox(buildVox(3, 3, 3, [0x80, 0x80, 0x80])));
  assert.equal(model.voxels.length, 27 - 1);
});

test("luminance is higher for brighter colors", () => {
  assert.ok(luminance("#ffffff") > luminance("#000000"));
  assert.ok(Math.abs(luminance("#ffffff") - 1) < 1e-6);
});
