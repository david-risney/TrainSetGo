// Level editor (US5, FR-033..FR-038). The editor is the *normal game map view* with a
// grouped tile palette: pick a tile from Track / Stations / Terrain and paint it onto
// the hex map by tapping. "Save & Play" compiles the painted map into a level definition
// (validated by the model's loadLevel) and plays it. (User: "the level editor should not
// just be a JSON text editor … normal game map view … choose any kind of tile in
// different groups: track tiles, stations, terrains")

import { button, el } from "./dom.js";
import { loadLevel } from "../model/level.js";
import { TrackShape, TerrainType, ColorTheme } from "../model/constants.js";
import { drawPiecePreview } from "../view/piece-preview.js";
import { hexToWorld } from "../view/renderer.js";
import { TERRAIN_COLORS, themeColor } from "../view/voxel.js";

// The editable working area: a rectangular q/r patch of hexes the author paints on.
const REGION_Q = 3;
const REGION_R = 3;

// Palette groups, in the order the user listed them: track tiles, stations, terrains.
const TRACK_TOOLS = [
  TrackShape.STRAIGHT,
  TrackShape.SLIGHT_CURVE,
  TrackShape.SHARP_CURVE,
  TrackShape.SWITCH,
  TrackShape.CROSSING,
];
const STATION_TOOLS = [
  ColorTheme.RED,
  ColorTheme.BLUE,
  ColorTheme.GREEN,
  ColorTheme.YELLOW,
  ColorTheme.PURPLE,
];
const TERRAIN_TOOLS = [
  TerrainType.GRASS,
  TerrainType.FOREST,
  TerrainType.LAKE,
  TerrainType.MOUNTAIN,
];

export class EditorScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
    this.tiles = new Map(); // "q,r" -> { q, r, terrain, lock, track }
    this.stations = new Map(); // "q,r" -> { q, r, color }
    this.selectedTool = { group: "track", value: TrackShape.STRAIGHT };
    this.snapshot = null;
  }

  mount(root) {
    this.root = root;
    this._buildRegion();

    this.statusEl = el("span", { class: "status-line", "data-testid": "status" });
    this.errorEl = el("span", {
      class: "status-line",
      "data-testid": "editor-error",
      style: "color:#c0392b;flex:0 1 auto;",
    });

    const top = el("div", { class: "hud top" }, [
      el("strong", { text: "Level Editor" }),
      this.statusEl,
      this.errorEl,
      button("Save & Play", {
        class: "btn btn-primary",
        "data-testid": "btn-editor-play",
        onClick: () => this._play(),
      }),
      button("Menu", { class: "btn", "data-testid": "btn-menu", onClick: () => this.app.showMenu() }),
    ]);

    this.palette = el("div", { class: "editor-palette", "data-testid": "editor-palette" });
    this._buildPalette();
    const bottom = el("div", { class: "hud bottom" }, [this.palette]);

    const screen = el("div", { class: "screen", "data-testid": "screen-editor" }, [top, bottom]);
    root.appendChild(screen);

    this._setStatus("Tap a tile to paint. Re-tap a track tile to rotate it.");

    // Test hooks: deterministic, real handler paths (the canvas tap path is exercised
    // through the same _applyTool the pointer handler uses).
    this.app._editorHooks = {
      selectTool: (group, value) => this._selectTool(group, value),
      tapHex: (q, r) => this._applyTool({ q, r }),
      play: () => this._play(),
      stationCount: () => this.stations.size,
    };

    this._frameCamera();
    this._rebuildSnapshot();
    this._render();
  }

  // Build a blank rectangular patch of editable grass.
  _buildRegion() {
    this.tiles.clear();
    this.stations.clear();
    for (let r = -REGION_R; r <= REGION_R; r++) {
      for (let q = -REGION_Q; q <= REGION_Q; q++) {
        this.tiles.set(`${q},${r}`, {
          q,
          r,
          terrain: TerrainType.GRASS,
          lock: "editable",
          track: null,
        });
      }
    }
  }

  _buildPalette() {
    const groups = [
      { id: "track", label: "Track", tools: TRACK_TOOLS },
      { id: "station", label: "Stations", tools: STATION_TOOLS },
      { id: "terrain", label: "Terrain", tools: TERRAIN_TOOLS },
    ];
    this.toolNodes = [];
    for (const group of groups) {
      const items = el("div", { class: "tool-group-items" });
      for (const value of group.tools) {
        const node = this._buildToolButton(group.id, value);
        items.appendChild(node);
        this.toolNodes.push(node);
      }
      this.palette.appendChild(
        el("div", { class: "tool-group" }, [
          el("span", { class: "tool-group-label", text: group.label }),
          items,
        ]),
      );
    }
    this._updateActive();
  }

  _buildToolButton(group, value) {
    const node = button("", {
      class: "tool editor-tool",
      "data-testid": `tool-${group}-${value}`,
      "data-group": group,
      "data-value": value,
      title: `${group}: ${value}`,
      onClick: () => this._selectTool(group, value),
    });
    if (group === "track") {
      const canvas = el("canvas", { class: "piece-canvas", width: "40", height: "40" });
      node.appendChild(canvas);
      drawPiecePreview(canvas, value, 40);
    } else {
      const fill = group === "terrain" ? TERRAIN_COLORS[value]?.top : themeColor(value);
      node.appendChild(el("span", { class: "tool-swatch", style: `background:${fill};` }));
    }
    node._group = group;
    node._value = value;
    return node;
  }

  _selectTool(group, value) {
    this.selectedTool = { group, value };
    this._updateActive();
    this._setStatus(
      group === "track"
        ? "Tap to place track. Re-tap the same tile to rotate it."
        : `Painting ${group}: ${value}.`,
    );
  }

  _updateActive() {
    for (const node of this.toolNodes ?? []) {
      const active =
        node._group === this.selectedTool.group && node._value === this.selectedTool.value;
      node.classList.toggle("active", active);
    }
  }

  onTap(x, y) {
    const hex = this.app.renderer.screenToHex(x, y);
    this._applyTool(hex);
  }

  // Paint the selected tool onto a hex within the editable region.
  _applyTool(hex) {
    const key = `${hex.q},${hex.r}`;
    const tile = this.tiles.get(key);
    if (!tile) return; // outside the editable patch
    const { group, value } = this.selectedTool;

    if (group === "terrain") {
      tile.terrain = value;
      tile.track = null;
      tile.lock = value === TerrainType.GRASS ? "editable" : "locked";
      this.stations.delete(key);
    } else if (group === "station") {
      tile.terrain = TerrainType.STATION;
      tile.lock = "locked";
      tile.track = null;
      this.stations.set(key, { q: hex.q, r: hex.r, color: value });
    } else if (group === "track") {
      this.stations.delete(key);
      tile.terrain = TerrainType.GRASS;
      tile.lock = "locked";
      if (tile.track && tile.track.shape === value) {
        tile.track.orientation = (tile.track.orientation + 1) % 6;
      } else {
        tile.track = {
          shape: value,
          orientation: 0,
          switchState: value === TrackShape.SWITCH ? 0 : null,
        };
      }
    }

    if (this.errorEl) this.errorEl.textContent = "";
    this._rebuildSnapshot();
    this._render();
  }

  _rebuildSnapshot() {
    const tiles = [...this.tiles.values()].map((t) => ({
      q: t.q,
      r: t.r,
      terrain: t.terrain,
      lock: t.lock,
      track: t.track ? { ...t.track } : null,
    }));
    const stations = [...this.stations.values()].map((s) => ({ ...s }));
    this.snapshot = { levelId: null, tiles, stations, trains: [] };
  }

  _frameCamera() {
    const worlds = [...this.tiles.values()].map((t) => hexToWorld(t.q, t.r));
    this.app.renderer.fitWorld(worlds, { fillX: 0.82, fillY: 0.6, maxZoom: 1.2 });
  }

  _render() {
    this.app.renderer.render(this.snapshot);
  }

  afterRender() {}

  _setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  _error(text) {
    if (this.errorEl) this.errorEl.textContent = text;
  }

  // Compile the painted map into a level definition and play it.
  _play() {
    const stations = [...this.stations.values()];
    if (stations.length < 2) {
      this._error("Add at least two stations before playing.");
      return;
    }

    const grid = [...this.tiles.values()].map((t) => ({
      q: t.q,
      r: t.r,
      terrain: t.terrain,
      lock: t.lock,
      track: t.track ? { ...t.track } : null,
    }));

    // Auto-derive trains by pairing stations; an odd station links back to the first.
    const trains = [];
    for (let i = 0; i + 1 < stations.length; i += 2) {
      trains.push(this._makeTrain(stations[i], stations[i + 1], trains.length));
    }
    if (stations.length % 2 === 1) {
      trains.push(this._makeTrain(stations[stations.length - 1], stations[0], trains.length));
    }

    const def = {
      id: "custom-level",
      name: "Custom Level",
      seed: 1,
      grid,
      stations: stations.map((s) => ({ q: s.q, r: s.r, color: s.color })),
      trains,
      exitRequirement: { minRequiredDeliveredPct: 100 },
      unlockRules: [],
    };

    try {
      loadLevel(def); // validate before playing
    } catch (e) {
      this._error(`Invalid level: ${e.message}`);
      return;
    }
    this._error("");
    this.app.editorLevel = def;
    this.app.showGame(def.id, def);
  }

  _makeTrain(source, destination, index) {
    return {
      id: `t${index + 1}`,
      name: `Train ${index + 1}`,
      color: source.color,
      source: { q: source.q, r: source.r },
      destination: { q: destination.q, r: destination.r },
      startDelay: 0,
      required: true,
    };
  }

  dispose() {
    this.app._editorHooks = null;
  }
}
