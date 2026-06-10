// In-level play screen (arcade): trains run continuously while the player keeps placing,
// rotating, erasing track and toggling switches. There is no "Run" button. (US1, US4)

import { button, el } from "./dom.js";
import { GameModel } from "../model/simulation.js";
import { TrackShape } from "../model/constants.js";

// Real-time milliseconds a train spends crossing one tile. Deliberately slow for an
// arcade feel — the player must build ahead of the trains.
const TILE_MS = 900;

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
    this.finished = false;
    this._raf = null;
    this._lastStep = 0;
    this._progress = 0;
    this._frame = this._frame.bind(this);
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
          this._stopLoop();
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

    this.retryBtn = button("Restart", {
      class: "btn",
      "data-testid": "btn-retry",
      onClick: () => this.retry(),
    });

    const bottom = el("div", { class: "hud bottom" }, [palette, this.retryBtn]);
    const screen = el("div", { class: "screen", "data-testid": "screen-game" }, [top, bottom]);
    root.appendChild(screen);

    this._selectToolDom();

    // Expose test hooks (deterministic, real handler paths).
    this.app._gameHooks = {
      tapHex: (q, r) => this._applyToolAtHex({ q, r }),
      run: () => this.settle(),
      retry: () => this.retry(),
    };

    // Arcade: start the trains immediately and animate continuously.
    this._startLoop();
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
      this._saveInProgress();
      this._render();
    }
    return res;
  }

  _saveInProgress() {
    if (this.finished) return;
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
    this.app.renderer.render(this.model.getState(), this._progress);
  }

  _setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  // --- Live arcade loop ----------------------------------------------------

  _startLoop() {
    this.model.startRun();
    this.running = true;
    this.finished = false;
    this._lastStep = performance.now();
    this._progress = 0;
    this._setStatus("Go! Lay track before the trains arrive…");
    this._render();
    this._raf = requestAnimationFrame(this._frame);
  }

  _frame(now) {
    if (!this.running) return;
    const elapsed = now - this._lastStep;
    this._progress = Math.min(elapsed / TILE_MS, 1);
    if (elapsed >= TILE_MS) {
      this.model.step();
      this._lastStep = now;
      this._progress = 0;
      if (this.model.isRunComplete()) {
        this._render();
        this._finishRun();
        return;
      }
      this._setStatus(`Running… ${this._liveSummary()}`);
    }
    this._render();
    this._raf = requestAnimationFrame(this._frame);
  }

  _liveSummary() {
    const trains = this.model.getState().trains;
    const done = trains.filter((t) => t.status === "completed").length;
    const lost = trains.filter((t) => t.status === "lost").length;
    return `delivered ${done}, lost ${lost}`;
  }

  // Deterministic fast-forward used by tests: replay the run with the current track.
  settle() {
    if (this.finished) return;
    this._stopLoop();
    this.model.running = false;
    this.model.startRun();
    this.model.runUntilComplete(2000);
    this._render();
    this._finishRun();
  }

  _finishRun() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this._stopLoop();
    const result = this.model.getRunResult();
    const unlocked = this.app.recordResult(this.levelDef, result);
    const verb = result.outcome === "cleared" ? "Cleared" : "Failed";
    let msg = `${verb} ${Math.round(result.completionPct)}%`;
    if (unlocked.length) msg += ` — unlocked: ${unlocked.join(", ")}`;
    this._setStatus(msg);
  }

  retry() {
    this._stopLoop();
    this.finished = false;
    this.running = false;
    this.model = new GameModel();
    this.model.setEventSink((e) => this.app.audio.onEvent(e));
    this.model.loadLevel(this.levelDef);
    this._restoreInProgress();
    this.app._gameHooks.tapHex = (q, r) => this._applyToolAtHex({ q, r });
    this._startLoop();
  }

  _stopLoop() {
    this.running = false;
    if (this._raf != null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  dispose() {
    this._stopLoop();
  }
}
