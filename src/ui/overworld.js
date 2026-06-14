// Overworld: rendered as the actual game scene. Each named station is a selectable
// level; locked levels are dimmed. (FR-025, FR-026; User: "overworld renders as the
// game with different named stations as the levels to pick")

import { button, el } from "./dom.js";
import { hexToWorld } from "../view/renderer.js";

// Spread the level hexes apart so grass terrain sits between the station "towns".
const SPREAD = 2;
const STATION_THEMES = ["red", "blue", "green", "yellow", "purple"];
const LOCKED_COLOR = "#b7ad8c";

export class OverworldScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
    this.nodes = []; // { id, el, hex }
  }

  mount(root) {
    const screen = el("div", { class: "screen", "data-testid": "screen-overworld" });
    screen.appendChild(
      el("div", { class: "hud top" }, [
        el("strong", { text: "Overworld" }),
        el("span", { class: "status-line", text: "Pick a station to play" }),
        button("Menu", { class: "btn", "data-testid": "btn-menu", onClick: () => this.app.showMenu() }),
      ]),
    );

    this.inner = el("div", { class: "overworld-inner", "data-testid": "overworld-map" });
    screen.appendChild(this.inner);
    root.appendChild(screen);

    this._buildScene();
    this._buildNodes();
    this.app.renderer.render(this.snapshot);
    this._positionNodes();
  }

  // Build a game-like snapshot: a patch of terrain with a station per level.
  _buildScene() {
    const levels = this.app.manifest.levels;
    const stationHexes = new Map(); // key -> {q,r,id,themeIndex}
    levels.forEach((entry, i) => {
      const q = entry.hex.q * SPREAD;
      const r = entry.hex.r * SPREAD;
      stationHexes.set(`${q},${r}`, { q, r, id: entry.id, themeIndex: i });
    });

    const qs = [...stationHexes.values()].map((s) => s.q);
    const rs = [...stationHexes.values()].map((s) => s.r);
    const minQ = Math.min(...qs) - 1;
    const maxQ = Math.max(...qs) + 1;
    const minR = Math.min(...rs) - 1;
    const maxR = Math.max(...rs) + 1;

    const tiles = [];
    const stations = [];
    for (let r = minR; r <= maxR; r++) {
      for (let q = minQ; q <= maxQ; q++) {
        const key = `${q},${r}`;
        const st = stationHexes.get(key);
        if (st) {
          tiles.push({ q, r, terrain: "station", lock: "locked", track: null });
          const unlocked = this.app.isUnlocked(st.id);
          stations.push({
            q,
            r,
            color: unlocked
              ? STATION_THEMES[st.themeIndex % STATION_THEMES.length]
              : LOCKED_COLOR,
          });
        } else {
          // A touch of terrain variety for a worldly look (deterministic).
          const h = (q * 73856093) ^ (r * 19349663);
          tiles.push({
            q,
            r,
            terrain: (h & 7) === 0 ? "forest" : "grass",
            lock: "locked",
            track: null,
          });
        }
      }
    }

    this.snapshot = { levelId: null, tiles, stations, trains: [] };
    this._stationHexes = stationHexes;

    // Frame the stations so the whole world is visible and centered.
    const worlds = [...stationHexes.values()].map((s) => hexToWorld(s.q, s.r));
    this.app.renderer.fitWorld(worlds, { fillX: 0.72, fillY: 0.55, maxZoom: 1.2 });
  }

  _buildNodes() {
    this.nodes = [];
    for (const entry of this.app.manifest.levels) {
      const def = this.app.levels.get(entry.id);
      const unlocked = this.app.isUnlocked(entry.id);
      const best = this.app.state.bestResults[entry.id];
      const label = `${def?.name ?? entry.id}${best ? ` · ${Math.round(best.completionPct)}%` : ""}`;
      const node = button(label, {
        class: `tool level-node ${unlocked ? "unlocked" : "locked"}`,
        "data-testid": `level-${entry.id}`,
        "data-locked": String(!unlocked),
        onClick: () => {
          if (this.app.isUnlocked(entry.id)) this.app.showGame(entry.id);
        },
      });
      node.disabled = !unlocked;
      this.inner.appendChild(node);
      this.nodes.push({
        id: entry.id,
        el: node,
        hex: { q: entry.hex.q * SPREAD, r: entry.hex.r * SPREAD },
      });
    }
  }

  // Keep the HTML level labels aligned over their station voxels.
  _positionNodes() {
    for (const n of this.nodes) {
      const w = hexToWorld(n.hex.q, n.hex.r);
      const s = this.app.renderer.worldToScreen(w);
      n.el.style.left = `${s.x}px`;
      n.el.style.top = `${s.y - 40}px`;
    }
  }

  // Called by the app after each re-render (pan/zoom) so labels track the scene.
  afterRender() {
    this._positionNodes();
  }

  dispose() {}
}
