# Authoring voxel models (`.vox`)

TrainSetGo renders the **train** and **station** props from MagicaVoxel `.vox` files. You
can edit or replace them with any voxel editor that exports `.vox`:

- **[Goxel](https://goxel.xyz/)** — free, open-source, also runs in the browser. Best fit.
- **[MagicaVoxel](https://ephtracy.github.io/)** — free, the de-facto standard.
- **[Blockbench](https://www.blockbench.net/)** — web app; box/voxel modelling.

## Where the models live

```
src/assets/models/
  manifest.json   # which models exist + how they render
  train.vox
  station.vox
```

`manifest.json` entries:

```jsonc
{ "name": "train",     // looked up by the renderer
  "file": "train.vox",
  "tint": "theme",     // "theme" = recolor by the entity's color; "none" = use authored colors
  "footprint": 1.05,   // model width as a fraction of the hex radius
  "lift": 0 }          // pixels above the tile top
```

## Authoring conventions

- **Orientation:** `+X` is **forward** (the train's nose / the station's door-and-track
  side), `+Y` is right, `+Z` is up. The renderer rotates models to face their track, so
  build them pointing along `+X`.
- **Color / `tint: "theme"`:** author in **grayscale**. At draw time each voxel's
  luminance becomes a shade of the entity's theme color (a red train, a blue station…).
  Brighter voxels read as highlights, darker ones as detail (doors, chimneys, wheels).
  Use `tint: "none"` to keep the authored colors instead.
- **Keep models small** (≈ a dozen voxels per axis). Fully-enclosed interior voxels are
  culled automatically, so solid shapes are fine.

## Regenerating the starter models

The bundled models are produced by a script you can tweak:

```sh
npm run make-models   # writes src/assets/models/train.vox and station.vox
```

If a model fails to load, the renderer silently falls back to its built-in procedural
boxes, so the game always renders.
