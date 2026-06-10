// Seeded deterministic PRNG (mulberry32). DOM-free; never reads wall clock. (FR-048)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small stateful wrapper used by the model.
export class Rng {
  constructor(seed = 0) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }

  // Float in [0, 1).
  float() {
    return this._next();
  }

  // Integer in [0, n).
  int(n) {
    return Math.floor(this._next() * n);
  }

  reset() {
    this._next = mulberry32(this.seed);
  }
}
