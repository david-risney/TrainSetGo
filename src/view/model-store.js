// Loads voxel models (.vox) named in a manifest and exposes parsed, render-ready models
// to the renderer. Browser-only (uses fetch). Loading is best-effort: a missing or invalid
// model simply leaves a gap, and the renderer falls back to its procedural placeholder.
//
// Manifest shape (src/assets/models/manifest.json):
//   { "models": [ { "name": "train", "file": "train.vox", "tint": "theme",
//                   "footprint": 0.95, "lift": 0 }, ... ] }
//   - tint "theme": the model is authored in grayscale and recolored at draw time by the
//     entity's theme color (the voxel luminance becomes the shade). tint "none": use the
//     authored voxel colors as-is.
//   - footprint: model width as a fraction of the hex radius. lift: px above the tile top.

import { parseVox, normalizeModel } from "./vox.js";

export class ModelStore {
  constructor() {
    this.models = new Map(); // name -> { ...normalized, tint, footprint, lift }
  }

  get(name) {
    return this.models.get(name) ?? null;
  }

  has(name) {
    return this.models.has(name);
  }

  // Load + parse every model in the manifest. Resolves once all settle; individual
  // failures are swallowed so a broken asset never blocks startup.
  async load(manifestUrl, baseUrl = "") {
    let manifest;
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) return;
      manifest = await res.json();
    } catch {
      return;
    }
    const entries = manifest?.models ?? [];
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const res = await fetch(baseUrl + entry.file);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const model = normalizeModel(parseVox(buf));
          if (!model.voxels.length) return;
          this.models.set(entry.name, {
            ...model,
            tint: entry.tint ?? "none",
            footprint: typeof entry.footprint === "number" ? entry.footprint : 1,
            lift: typeof entry.lift === "number" ? entry.lift : 0,
          });
        } catch {
          /* skip this model; renderer falls back to a procedural placeholder */
        }
      }),
    );
  }
}
