// Level editor: author a level definition (JSON-backed) and play it. (US5, FR-033..FR-038)

import { button, el } from "./dom.js";
import { loadLevel } from "../model/level.js";

const MINIMAL_TEMPLATE = {
  id: "custom-level",
  name: "Custom Level",
  seed: 1,
  grid: [
    { q: -1, r: 0, terrain: "station", lock: "locked", track: null },
    { q: 0, r: 0, terrain: "grass", lock: "editable", track: null },
    { q: 1, r: 0, terrain: "station", lock: "locked", track: null },
  ],
  stations: [
    { q: -1, r: 0, color: "green" },
    { q: 1, r: 0, color: "green" },
  ],
  trains: [
    {
      id: "c1",
      name: "Custom",
      color: "green",
      source: { q: -1, r: 0 },
      destination: { q: 1, r: 0 },
      startDelay: 0,
      required: true,
    },
  ],
  exitRequirement: { minRequiredDeliveredPct: 100 },
  unlockRules: [],
};

export class EditorScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
  }

  mount(root) {
    const panel = el("div", { class: "screen editor-panel", "data-testid": "screen-editor" }, [
      el("h2", { text: "Level Editor" }),
      el("p", {
        class: "status-line",
        text: "Author a level as JSON (grid, lock states, stations, trains, exit requirement, unlock rules), then play it.",
      }),
    ]);

    this.textarea = el("textarea", {
      "data-testid": "editor-json",
      rows: "18",
      style: "width:100%;font-family:monospace;font-size:0.85rem;",
    });
    this.textarea.value = JSON.stringify(MINIMAL_TEMPLATE, null, 2);

    this.errorEl = el("div", {
      class: "status-line",
      "data-testid": "editor-error",
      style: "color:#ff9a9a;min-height:1.2em;",
    });

    const controls = el("div", { class: "row" }, [
      button("New Minimal Level", {
        class: "btn",
        "data-testid": "btn-editor-minimal",
        onClick: () => {
          this.textarea.value = JSON.stringify(MINIMAL_TEMPLATE, null, 2);
          this.errorEl.textContent = "";
        },
      }),
      button("Save & Play", {
        class: "btn",
        "data-testid": "btn-editor-play",
        onClick: () => this._play(),
      }),
      button("Menu", { class: "btn", "data-testid": "btn-menu", onClick: () => this.app.showMenu() }),
    ]);

    panel.appendChild(this.textarea);
    panel.appendChild(this.errorEl);
    panel.appendChild(controls);
    root.appendChild(panel);
  }

  _play() {
    let def;
    try {
      def = JSON.parse(this.textarea.value);
    } catch (e) {
      this.errorEl.textContent = `Invalid JSON: ${e.message}`;
      return;
    }
    try {
      loadLevel(def); // validate before playing
    } catch (e) {
      this.errorEl.textContent = `Invalid level: ${e.message}`;
      return;
    }
    this.errorEl.textContent = "";
    this.app.editorLevel = def;
    this.app.showGame(def.id, def);
  }

  dispose() {}
}
