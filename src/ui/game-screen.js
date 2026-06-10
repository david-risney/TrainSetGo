// In-level play screen: tool palette, place/rotate/remove, switch toggle, run, result.
// (US1, US4; FR-003..FR-009, FR-027)

import { button, el } from "./dom.js";
import { GameModel } from "../model/simulation.js";
import { TrackShape } from "../model/constants.js";

const PLACE_TOOLS = [
  { id: "straight", label: "Straight", shape: TrackShape.STRAIGHT },
  { id: "slightCurve", label: "Slight", shape: TrackShape.SLIGHT_CURVE },
  { id: "sharpCurve", label: "Sharp", shape: TrackShape.SHARP_CURVE },
  { id: "switch", label: "Switch", shape: TrackShape.SWITCH },
  { id: "crossing", label: "Crossing", shape: TrackShape.CROSSING },
];

export class GameScreen {
  constructor(app, levelDef) {
    this.app = app;
    this.levelDef = levelDef;
    this.model = new GameModel();
    this.model.setEventSink((e) => this.app.audio.onEvent(e));
    this.model.loadLevel(levelDef);
    this.tool = "straight";
    this.running = false;
    this._timer = null;
    this._restoreInProgress();
  }

  _restoreInProgress() {
    const ip = this.app.state.inProgress;
    if (!ip || ip.levelId !== this.levelDef.id) return;
    for (const p of ip.tilePlacements ?? []) {
      this.model.placeTrack({ q: p.q, r: p.r }, p.shape, p.orientation ?? 0, p.switchState ?? null);
    }
    for (const sw of ip.switchStates ?? []) {
      const tile = this.model.getState().tiles.find((t) => t.q === sw.q && t.r === sw.r);
      if (tile?.track) {
        // toggle until it matches the saved branch
        let guard = 0;
        while (
          (this.model.getState().tiles.find((t) => t.q === sw.q && t.r === sw.r).track.switchState ?? 0) !==
            sw.switchState &&
          guard++ < 6
        ) {
          this.model.toggleSwitch({ q: sw.q, r: sw.r });
        }
      }
    }
  }

  mount(root) {
    this.root = root;
    this.app.audio.startMusic();

    this.statusEl = el("span", { class: "status-line", "data-testid": "status" });
    const top = el("div", { class: "hud top" }, [
      el("strong", { text: this.levelDef.name }),
      this.statusEl,
      button("Back", {
        class: "btn",
        "data-testid": "btn-back",
        onClick: () => {
          this._stopTimer();
          this.app.showOverworld();
        },
      }),
    ]);

    const palette = el("div", { class: "palette", "data-testid": "palette" });
    for (const t of PLACE_TOOLS) {
      palette.appendChild(
        button(t.label, {
          class: "tool",
          "data-testid": `tool-${t.id}`,
          onClick: (e) => this._selectTool(t.id, e.currentTarget),
        }),
      );
    }
    for (const extra of [
      { id: "rotate", label: "Rotate" },
      { id: "erase", label: "Erase" },
      { id: "toggle", label: "Toggle" },
    ]) {
      palette.appendChild(
        button(extra.label, {
          class: "tool",
          "data-testid": `tool-${extra.id}`,
          onClick: (e) => this._selectTool(extra.id, e.currentTarget),
        }),
      );
    }

    this.runBtn = button("Run", {
      class: "btn",
      "data-testid": "btn-run",
      onClick: () => this.run(),
    });
    this.retryBtn = button("Retry", {
      class: "btn",
      "data-testid": "btn-retry",
      onClick: () => this.retry(),
    });
    this.retryBtn.style.display = "none";

    const bottom = el("div", { class: "hud bottom" }, [palette, this.runBtn, this.retryBtn]);

    const screen = el("div", { class: "screen", "data-testid": "screen-game" }, [top, bottom]);
    root.appendChild(screen);

    this._selectToolDom();
    this._render();
    this._setStatus("Editing");

    // Expose test hooks for end-to-end tests (real handler paths).
    this.app._gameHooks = {
      tapHex: (q, r) => this._applyToolAtHex({ q, r }),
      run: () => this.runToCompletion(),
      retry: () => this.retry(),
    };
  }

  _selectTool(id, node) {
    this.tool = id;
    this._selectToolDom(node);
  }

  _selectToolDom(node) {
    this.root.querySelectorAll(".tool").forEach((b) => b.classList.remove("active"));
    const active = node ?? this.root.querySelector(`[data-testid="tool-${this.tool}"]`);
    active?.classList.add("active");
  }

  onTap(x, y) {
    const hex = this.app.renderer.screenToHex(x, y);
    this._applyToolAtHex(hex);
  }

  _applyToolAtHex(hex) {
    let res;
    if (this.tool === "rotate") res = this.model.rotateTrack(hex);
    else if (this.tool === "erase") res = this.model.removeTrack(hex);
    else if (this.tool === "toggle") res = this.model.toggleSwitch(hex);
    else {
      const tool = PLACE_TOOLS.find((t) => t.id === this.tool);
      res = this.model.placeTrack(hex, tool.shape, 0);
    }
    if (res?.ok) {
      this._render();
      if (!this.running) this._saveInProgress();
    }
    return res;
  }

  _saveInProgress() {
    const state = this.model.getState();
    const tilePlacements = state.tiles
      .filter((t) => t.playerPlaced && t.track)
      .map((t) => ({
        q: t.q,
        r: t.r,
        shape: t.track.shape,
        orientation: t.track.orientation,
        switchState: t.track.switchState,
      }));
    const switchStates = state.tiles
      .filter((t) => t.track && t.track.shape === TrackShape.SWITCH)
      .map((t) => ({ q: t.q, r: t.r, switchState: t.track.switchState ?? 0 }));
    this.app.saveInProgress(this.levelDef.id, tilePlacements, switchStates);
  }

  _render() {
    this.app.renderer.render(this.model.getState());
  }

  _setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  run() {
    if (this.running) return;
    this.model.startRun();
    this.running = true;
    this.runBtn.disabled = true;
    this._setStatus("Running…");
    this._timer = setInterval(() => {
      this.model.step();
      this._render();
      if (this.model.isRunComplete()) {
        this._stopTimer();
        this._finishRun();
      } else {
        this._setStatus(`Running… tick ${this.model.getState().tick}`);
      }
    }, 120);
  }

  // Synchronous run for tests/headless validation.
  runToCompletion() {
    if (this.running) return;
    this.model.startRun();
    this.running = true;
    this.runBtn.disabled = true;
    this.model.runUntilComplete(2000);
    this._render();
    this._finishRun();
  }

  _finishRun() {
    const result = this.model.getRunResult();
    const unlocked = this.app.recordResult(this.levelDef, result);
    const verb = result.outcome === "cleared" ? "Cleared" : "Failed";
    let msg = `${verb} ${Math.round(result.completionPct)}%`;
    if (unlocked.length) msg += ` — unlocked: ${unlocked.join(", ")}`;
    this._setStatus(msg);
    this.runBtn.style.display = "none";
    this.retryBtn.style.display = "";
  }

  retry() {
    this._stopTimer();
    this.running = false;
    this.model = new GameModel();
    this.model.setEventSink((e) => this.app.audio.onEvent(e));
    this.model.loadLevel(this.levelDef);
    this._restoreInProgress();
    this.runBtn.style.display = "";
    this.runBtn.disabled = false;
    this.retryBtn.style.display = "none";
    this._render();
    this._setStatus("Editing");
    this.app._gameHooks.tapHex = (q, r) => this._applyToolAtHex({ q, r });
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  dispose() {
    this._stopTimer();
  }
}
