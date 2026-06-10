// Main menu screen. (FR-041)

import { button, el } from "./dom.js";

export class MenuScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
  }

  mount(root) {
    const hasProgress = this.app.state.inProgress != null;
    const screen = el("div", { class: "screen menu", "data-testid": "screen-menu" }, [
      el("h1", { text: "TrainSetGo" }),
      button(hasProgress ? "Continue" : "Start", {
        class: "btn",
        "data-testid": "btn-start",
        onClick: () => {
          // Resume an in-progress level if present, else go to the overworld.
          const ip = this.app.state.inProgress;
          if (ip && this.app.levels.has(ip.levelId)) this.app.showGame(ip.levelId);
          else this.app.showOverworld();
        },
      }),
      button("Level Editor", {
        class: "btn",
        "data-testid": "btn-editor",
        onClick: () => this.app.showEditor(),
      }),
      button("Settings", {
        class: "btn",
        "data-testid": "btn-settings",
        onClick: () => this.app.showSettings(),
      }),
    ]);
    root.appendChild(screen);
  }

  dispose() {}
}
