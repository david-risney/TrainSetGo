import test from "node:test";
import assert from "node:assert/strict";
import {
  edgeTo,
  hexDistance,
  hexEquals,
  neighbor,
  neighbors,
  oppositeEdge,
  rotateEdge,
} from "../../src/model/hex.js";

test("neighbors returns 6 distinct adjacent hexes", () => {
  const ns = neighbors({ q: 0, r: 0 });
  assert.equal(ns.length, 6);
  const keys = new Set(ns.map((h) => `${h.q},${h.r}`));
  assert.equal(keys.size, 6);
});

test("edgeTo is the inverse of neighbor", () => {
  for (let e = 0; e < 6; e++) {
    const nb = neighbor({ q: 2, r: -1 }, e);
    assert.equal(edgeTo({ q: 2, r: -1 }, nb), e);
  }
});

test("edgeTo returns -1 for non-adjacent hexes", () => {
  assert.equal(edgeTo({ q: 0, r: 0 }, { q: 5, r: 5 }), -1);
});

test("oppositeEdge faces back", () => {
  for (let e = 0; e < 6; e++) {
    const nb = neighbor({ q: 0, r: 0 }, e);
    assert.equal(edgeTo(nb, { q: 0, r: 0 }), oppositeEdge(e));
  }
});

test("hexDistance is symmetric and zero on self", () => {
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 }), 0);
  assert.equal(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 }), 3);
  assert.equal(hexDistance({ q: 1, r: -2 }, { q: 0, r: 0 }), hexDistance({ q: 0, r: 0 }, { q: 1, r: -2 }));
});

test("rotateEdge wraps modulo 6", () => {
  assert.equal(rotateEdge(5, 1), 0);
  assert.equal(rotateEdge(0, -1), 5);
});

test("hexEquals", () => {
  assert.ok(hexEquals({ q: 1, r: 2 }, { q: 1, r: 2 }));
  assert.ok(!hexEquals({ q: 1, r: 2 }, { q: 2, r: 1 }));
});
