// Overworld: the home screen. It merges the old main menu and the level-select map —
// rendered as the actual game scene. Each named station is a selectable level; locked
// levels are dimmed. Settings is its own station. The editor has no node here; it lives
// at its own /editor URL. (FR-025, FR-026; User: "merge the main menu and the level
// select screen ... make settings its own train station on the overworld")

import { button, el } from "./dom.js";
import { hexToWorld } from "../view/renderer.js";
import { createNowPlaying } from "./now-playing.js";

// Spread the level hexes apart so grass terrain sits between the station "towns".
const SPREAD = 2;
const STATION_THEMES = ["red", "blue", "green", "yellow", "purple"];
const LOCKED_COLOR = "#b7ad8c";
// The Settings station sits on a free hex to the west of the levels (SPREAD-aligned).
const SETTINGS_HEX = { q: -2, r: 0 };
const SETTINGS_COLOR = "#a78bfa";

export class OverworldScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
    this.nodes = []; // { id, el, hex }
  }

  mount(root) {
    const screen = el("div", { class: "screen", "data-testid": "screen-overworld" });
    this.app.audio.playMenuMusic();

    const ip = this.app.state.inProgress;
    const canContinue = ip != null && this.app.levels.has(ip.levelId);
    this._nowPlaying = createNowPlaying(this.app);
    screen.appendChild(
      el("div", { class: "hud top overworld-hud" }, [
        el("strong", { class: "overworld-title", text: "🚂 TrainSetGo" }),
        el("span", { class: "status-line", text: "Pick a station to play" }),
        this._nowPlaying.el,
        button(canContinue ? "Continue" : "Play", {
          class: "btn btn-primary",
          "data-testid": "btn-start",
          onClick: () => {
            const cur = this.app.state.inProgress;
            if (cur && this.app.levels.has(cur.levelId)) this.app.showGame(cur.levelId);
            else this._playFirstUnlocked();
          },
        }),
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

  // Start the first unlocked level (fallback for the Play button when nothing is in progress).
  _playFirstUnlocked() {
    const entry = this.app.manifest.levels.find((e) => this.app.isUnlocked(e.id));
    if (entry) this.app.showGame(entry.id);
  }

  // Build a game-like snapshot: a patch of terrain with a station per level + settings.
  _buildScene() {
    const levels = this.app.manifest.levels;
    const stationHexes = new Map(); // key -> {q,r,id,themeIndex,settings?}
    levels.forEach((entry, i) => {
      const q = entry.hex.q * SPREAD;
      const r = entry.hex.r * SPREAD;
      stationHexes.set(`${q},${r}`, { q, r, id: entry.id, themeIndex: i });
    });
    // Settings is a station too, but it navigates to /settings rather than a level.
    stationHexes.set(`${SETTINGS_HEX.q},${SETTINGS_HEX.r}`, {
      q: SETTINGS_HEX.q,
      r: SETTINGS_HEX.r,
      id: "settings",
      settings: true,
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
          let color;
          if (st.settings) color = SETTINGS_COLOR;
          else if (this.app.isUnlocked(st.id))
            color = STATION_THEMES[st.themeIndex % STATION_THEMES.length];
          else color = LOCKED_COLOR;
          stations.push({ q, r, color });
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

    // The Settings station node.
    const settingsNode = button("⚙ Settings", {
      class: "tool level-node settings-node unlocked",
      "data-testid": "btn-settings",
      "data-locked": "false",
      onClick: () => this.app.showSettings(),
    });
    this.inner.appendChild(settingsNode);
    this.nodes.push({ id: "settings", el: settingsNode, hex: { ...SETTINGS_HEX } });
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

  dispose() {
    this._nowPlaying?.dispose();
  }
}
