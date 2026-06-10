// Overworld: hex-grid level selection reflecting locked/unlocked status. (FR-025, FR-026)

import { button, el } from "./dom.js";
import { hexToWorld } from "../view/renderer.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Spread the hex layout out so button-sized nodes never overlap (the raw in-game
// hex spacing is far too tight for ~110px wide level cards).
const SPREAD = 3;

export class OverworldScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
  }

  mount(root) {
    const screen = el("div", { class: "screen", "data-testid": "screen-overworld" });
    screen.appendChild(
      el("div", { class: "hud top" }, [
        el("span", { class: "status-line", text: "Overworld — select a level" }),
        button("Menu", { class: "btn", "data-testid": "btn-menu", onClick: () => this.app.showMenu() }),
      ]),
    );

    const map = el("div", { class: "overworld-grid", "data-testid": "overworld-map" });

    // Resolve every level's spread-out world position, then centre the bounding box.
    const pos = new Map();
    for (const entry of this.app.manifest.levels) {
      const w = hexToWorld(entry.hex.q, entry.hex.r);
      pos.set(entry.id, { x: w.x * SPREAD, y: w.y * SPREAD });
    }
    const xs = [...pos.values()].map((p) => p.x);
    const ys = [...pos.values()].map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const at = (id) => {
      const p = pos.get(id);
      return { x: p.x - cx, y: p.y - cy };
    };

    // Inner layer is the shared coordinate origin for both nodes and link lines.
    const inner = el("div", { class: "overworld-inner" });

    // Progression links drawn behind the nodes (source level -> levels it unlocks).
    const W = 900;
    const H = 500;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "overworld-links");
    svg.setAttribute("data-testid", "overworld-links");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `${-W / 2} ${-H / 2} ${W} ${H}`);
    for (const entry of this.app.manifest.levels) {
      const def = this.app.levels.get(entry.id);
      const from = at(entry.id);
      const targets = new Set();
      for (const rule of def?.unlockRules ?? []) {
        for (const id of rule.unlocks ?? []) if (pos.has(id)) targets.add(id);
      }
      for (const id of targets) {
        const to = at(id);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(from.x));
        line.setAttribute("y1", String(from.y));
        line.setAttribute("x2", String(to.x));
        line.setAttribute("y2", String(to.y));
        line.setAttribute("class", this.app.isUnlocked(id) ? "link unlocked" : "link locked");
        svg.appendChild(line);
      }
    }
    inner.appendChild(svg);

    for (const entry of this.app.manifest.levels) {
      const def = this.app.levels.get(entry.id);
      const unlocked = this.app.isUnlocked(entry.id);
      const best = this.app.state.bestResults[entry.id];
      const p = at(entry.id);
      const node = button(
        `${def?.name ?? entry.id}${best ? ` · ${Math.round(best.completionPct)}%` : ""}`,
        {
          class: `tool level-node ${unlocked ? "unlocked" : "locked"}`,
          "data-testid": `level-${entry.id}`,
          "data-locked": String(!unlocked),
          onClick: () => {
            if (this.app.isUnlocked(entry.id)) this.app.showGame(entry.id);
          },
        },
      );
      node.disabled = !unlocked;
      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
      inner.appendChild(node);
    }

    map.appendChild(inner);
    screen.appendChild(map);
    root.appendChild(screen);
  }

  dispose() {}
}
