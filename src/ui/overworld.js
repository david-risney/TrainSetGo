// Overworld: hex-grid level selection reflecting locked/unlocked status. (FR-025, FR-026)

import { button, el } from "./dom.js";
import { hexToWorld } from "../view/renderer.js";

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

    // Position level nodes using the same hex layout as in-game.
    const map = el("div", { class: "overworld-grid", "data-testid": "overworld-map" });
    map.style.position = "relative";
    for (const entry of this.app.manifest.levels) {
      const def = this.app.levels.get(entry.id);
      const unlocked = this.app.isUnlocked(entry.id);
      const best = this.app.state.bestResults[entry.id];
      const w = hexToWorld(entry.hex.q, entry.hex.r);
      const node = button(
        `${def?.name ?? entry.id}${best ? ` (${Math.round(best.completionPct)}%)` : ""}`,
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
      node.style.position = "absolute";
      node.style.left = `calc(50% + ${w.x}px)`;
      node.style.top = `calc(40% + ${w.y}px)`;
      node.style.transform = "translate(-50%, -50%)";
      map.appendChild(node);
    }
    screen.appendChild(map);
    root.appendChild(screen);
  }

  dispose() {}
}
