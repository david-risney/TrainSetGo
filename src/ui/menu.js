// Main menu screen. (FR-041)

import { button, el } from "./dom.js";

export class MenuScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
  }

  mount(root) {
    const hasProgress = this.app.state.inProgress != null;
    const card = el("div", { class: "menu-card" }, [
      el("div", { class: "menu-logo", text: "🚂", "aria-hidden": "true" }),
      el("h1", { text: "TrainSetGo" }),
      el("p", { class: "menu-tagline", text: "Lay the tracks. Deliver every train!" }),
      el("div", { class: "menu-actions" }, [
        button(hasProgress ? "Continue" : "Play", {
          class: "btn btn-primary",
          "data-testid": "btn-start",
          onClick: () => {
            // Resume an in-progress level if present, else go to the overworld.
            const ip = this.app.state.inProgress;
            if (ip && this.app.levels.has(ip.levelId)) this.app.showGame(ip.levelId);
            else this.app.showOverworld();
          },
        }),
        button("🛠 Level Editor", {
          class: "btn btn-secondary",
          "data-testid": "btn-editor",
          onClick: () => this.app.showEditor(),
        }),
        button("⚙ Settings", {
          class: "btn btn-secondary",
          "data-testid": "btn-settings",
          onClick: () => this.app.showSettings(),
        }),
      ]),
    ]);
    const screen = el("div", { class: "screen menu", "data-testid": "screen-menu" }, [card]);
    root.appendChild(screen);
  }

  dispose() {}
}
