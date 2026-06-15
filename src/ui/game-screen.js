// In-level play screen (arcade): trains run continuously while the player keeps placing
// track and toggling switches. Pieces auto-rotate to best fit; a floating button lets the
// player nudge the last placed piece's rotation. There is no Run/Restart button. (US1, US4)

import { button, el } from "./dom.js";
import { createNowPlaying } from "./now-playing.js";
import { GameModel } from "../model/simulation.js";
import { TrackShape } from "../model/constants.js";
import { TrainStatus } from "../model/constants.js";
import { Rng } from "../model/rng.js";
import { drawPiecePreview } from "../view/piece-preview.js";
import { hexToWorld } from "../view/renderer.js";

// Real-time milliseconds a train spends crossing one tile. Deliberately slow for an
// arcade feel — the player must build ahead of the trains.
const TILE_MS = 900;

// The pool of placeable track shapes the random "hand" is drawn from.
const SHAPE_POOL = [
  TrackShape.STRAIGHT,
  TrackShape.SLIGHT_CURVE,
  TrackShape.SHARP_CURVE,
  TrackShape.SWITCH,
  TrackShape.CROSSING,
];

// Number of random pieces offered at the bottom to choose from. (User request)
const HAND_SIZE = 4;

export class GameScreen {
  constructor(app, levelDef) {
    this.app = app;
    this.levelDef = levelDef;
    this.model = new GameModel();
    this.model.setEventSink((e) => this.app.audio.onEvent(e));
    this.model.loadLevel(levelDef);
    // Deterministic hand RNG (kept separate from the simulation RNG).
    this._handRng = new Rng((levelDef.seed ?? 0) ^ 0x5eed1234);
    this.hand = Array.from({ length: HAND_SIZE }, () => this._drawShape());
    this.selectedSlot = 0;
    this.rotateHex = null; // the placed piece the floating Rotate button acts on
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
    this.app.audio.playLevelMusic(this.levelDef.music);

    this.statusEl = el("span", { class: "status-line", "data-testid": "status" });
    this._nowPlaying = createNowPlaying(this.app);
    const top = el("div", { class: "hud top" }, [
      el("strong", { text: this.levelDef.name }),
      this.statusEl,
      this._nowPlaying.el,
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
    this.slotNodes = [];
    for (let i = 0; i < HAND_SIZE; i++) {
      const canvas = el("canvas", { class: "piece-canvas", width: "48", height: "48" });
      const slot = button("", {
        class: "tool piece-slot",
        "data-testid": `tool-slot-${i}`,
        title: "Track piece",
        onClick: () => this._selectSlot(i),
      });
      slot.appendChild(canvas);
      slot._canvas = canvas;
      this.slotNodes.push(slot);
      palette.appendChild(slot);
    }

    const bottom = el("div", { class: "hud bottom" }, [palette]);

    // Floating "rotate" button that hovers next to the most recently placed piece.
    this.rotateBtn = button("⟳", {
      class: "piece-rotate-btn",
      "data-testid": "btn-rotate-piece",
      title: "Rotate this piece",
      onClick: () => this._rotatePlaced(),
    });
    this.rotateBtn.style.display = "none";

    const screen = el("div", { class: "screen", "data-testid": "screen-game" }, [
      top,
      bottom,
      this.rotateBtn,
    ]);
    root.appendChild(screen);

    // Render the piece models into each slot and highlight the active slot.
    for (let i = 0; i < HAND_SIZE; i++) this._renderSlot(i);
    this._updateActive();

    // Escape returns to the main menu while playing. (User request) While the end-of-level
    // summary is open it owns the Escape key, so the live game ignores it.
    this._onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (this.summaryEl) return;
        this._stopLoop();
        this.app.showOverworld();
      }
    };
    window.addEventListener("keydown", this._onKeyDown);

    // Expose test hooks (deterministic, real handler paths). tapHex places a STRAIGHT
    // piece directly so e2e corridor tests stay stable regardless of the random hand.
    this.app._gameHooks = {
      tapHex: (q, r) => this._placeStraight({ q, r }),
      run: () => this.settle(),
      retry: () => this.retry(),
    };

    // Frame the camera on the level so the default view is zoomed in a bit. (User request)
    this._frameCamera();

    // Arcade: start the trains immediately and animate continuously.
    this._startLoop();
  }

  _frameCamera() {
    const worlds = this.model.getState().tiles.map((t) => hexToWorld(t.q, t.r));
    this.app.renderer.fitWorld(worlds, { fillX: 0.86, fillY: 0.66, maxZoom: 1.6 });
  }

  _drawShape() {
    return SHAPE_POOL[this._handRng.int(SHAPE_POOL.length)];
  }

  _renderSlot(i) {
    const node = this.slotNodes?.[i];
    if (node?._canvas) drawPiecePreview(node._canvas, this.hand[i]);
  }

  _selectSlot(i) {
    this.selectedSlot = i;
    this._updateActive();
  }

  _updateActive() {
    if (!this.root) return;
    this.root.querySelectorAll(".tool").forEach((b) => b.classList.remove("active"));
    this.slotNodes?.[this.selectedSlot]?.classList.add("active");
  }

  _tileAt(hex) {
    return this.model.getState().tiles.find((t) => t.q === hex.q && t.r === hex.r) ?? null;
  }

  onTap(x, y) {
    const hex = this.app.renderer.screenToHex(x, y);
    this._applyToolAtHex(hex);
  }

  // Place a fixed straight piece (deterministic path used by tests).
  _placeStraight(hex) {
    const res = this.model.placeTrack(hex, TrackShape.STRAIGHT, 0);
    if (res?.ok) {
      this._showRotateAt(hex);
      this._saveInProgress();
      this._render();
    }
    return res;
  }

  _applyToolAtHex(hex) {
    const tile = this._tileAt(hex);
    // Tapping an existing switch toggles it. (Toggle button removed.)
    if (tile?.track && tile.track.shape === TrackShape.SWITCH) {
      const res = this.model.toggleSwitch(hex);
      if (res?.ok) {
        this._saveInProgress();
        this._render();
      }
      return res;
    }
    // Tapping an already-placed (non-switch) piece re-anchors the rotate button to it.
    if (tile?.track && tile.playerPlaced) {
      this._showRotateAt(hex);
      this._render();
      return { ok: true };
    }
    // Otherwise place the selected random piece, auto-rotated to best fit, and refill.
    const shape = this.hand[this.selectedSlot];
    const res = this.model.placeTrackAutoFit(hex, shape);
    if (res?.ok) {
      this._consumeSlot(this.selectedSlot);
      this._showRotateAt(hex);
      this._saveInProgress();
      this._render();
    }
    return res;
  }

  // Consume a slot from the hand: remove it, slide the remaining pieces left, and draw a
  // fresh random piece into the right-most slot. (User: shift left + refill rightmost.)
  _consumeSlot(i) {
    this.hand.splice(i, 1);
    this.hand.push(this._drawShape());
    for (let k = 0; k < HAND_SIZE; k++) this._renderSlot(k);
  }

  // Rotate the piece the floating button is anchored to.
  _rotatePlaced() {
    if (!this.rotateHex) return;
    const res = this.model.rotateTrack(this.rotateHex);
    if (res?.ok) {
      this._saveInProgress();
      this._render();
    }
  }

  _showRotateAt(hex) {
    this.rotateHex = { q: hex.q, r: hex.r };
    if (this.rotateBtn) this.rotateBtn.style.display = "";
    this._positionRotateButton();
  }

  _positionRotateButton() {
    if (!this.rotateBtn || !this.rotateHex || this.rotateBtn.style.display === "none") return;
    const w = hexToWorld(this.rotateHex.q, this.rotateHex.r);
    const s = this.app.renderer.worldToScreen(w);
    this.rotateBtn.style.left = `${s.x + 26}px`;
    this.rotateBtn.style.top = `${s.y - 34}px`;
  }

  // Keep the floating rotate button anchored when the camera pans/zooms/rotates.
  afterRender() {
    this._positionRotateButton();
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
    const state = this.model.getState();
    this.app.renderer.render(state, this._progress, { countdowns: this._stationCountdowns(state) });
  }

  // Seconds until each station produces its next train, shown only when 10s or less remain.
  // A train is produced when model tick passes its startDelay; one continuous tick equals
  // TILE_MS, so real seconds remaining = (startDelay + 1 - (tick + progress)) * TILE_MS.
  _stationCountdowns(state) {
    const byKey = new Map();
    for (const t of state.trains) {
      if (t.status !== TrainStatus.WAITING) continue;
      const secs = ((t.startDelay + 1 - (state.tick + this._progress)) * TILE_MS) / 1000;
      if (secs <= 0 || secs > 10) continue;
      const key = `${t.position.q},${t.position.r}`;
      const prev = byKey.get(key);
      if (prev == null || secs < prev) byKey.set(key, secs);
    }
    return [...byKey.entries()].map(([key, secs]) => {
      const [q, r] = key.split(",").map(Number);
      return { q, r, seconds: Math.ceil(secs) };
    });
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
    this._showSummary(result, unlocked);
  }

  // Next campaign level after this one that the player can play (already unlocked).
  _nextLevelId() {
    const levels = this.app.manifest?.levels ?? [];
    const idx = levels.findIndex((e) => e.id === this.levelDef.id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < levels.length; i++) {
      if (this.app.isUnlocked(levels[i].id)) return levels[i].id;
    }
    return null;
  }

  // End-of-level results modal: how the run went, what unlocked, and where to go next.
  _showSummary(result, unlocked) {
    const cleared = result.outcome === "cleared";
    const trains = this.model.getState().trains;
    const delivered = trains.filter((t) => t.status === "completed").length;
    const lost = trains.filter((t) => t.status === "lost").length;
    const nextId = this._nextLevelId();
    const unlockedNames = unlocked.map((id) => this.app.levels.get(id)?.name ?? id);

    const unlockRow = unlockedNames.length
      ? [
          el("span", { class: "summary-unlock-label", text: "Unlocked" }),
          ...unlockedNames.map((n) => el("span", { class: "summary-unlock", text: n })),
        ]
      : [
          el("span", {
            class: "summary-unlock-label muted",
            text: cleared ? "Nothing new unlocked" : "No new unlocks — try again!",
          }),
        ];

    const actions = [
      button("↻ Retry", {
        class: "btn btn-secondary",
        "data-testid": "btn-summary-retry",
        onClick: () => {
          this._closeSummary();
          this.retry();
        },
      }),
      button("Menu", {
        class: "btn",
        "data-testid": "btn-summary-menu",
        onClick: () => {
          this._closeSummary();
          this.app.showOverworld();
        },
      }),
    ];
    if (nextId) {
      actions.push(
        button("Next Level", {
          class: "btn btn-primary",
          "data-testid": "btn-summary-next",
          onClick: () => {
            this._closeSummary();
            this.app.showGame(nextId);
          },
        }),
      );
    }

    const dialog = el(
      "dialog",
      {
        class: `summary-dialog ${cleared ? "is-win" : "is-lose"}`,
        "data-testid": "screen-summary",
        "data-outcome": result.outcome,
        "aria-labelledby": "summary-title",
      },
      [
        el("div", { class: "summary-card" }, [
          el("div", { class: "summary-badge", text: cleared ? "🎉" : "💥" }),
          el("h2", {
            id: "summary-title",
            class: "summary-title",
            "data-testid": "summary-title",
            text: cleared ? "Level Cleared!" : "Level Failed",
          }),
          el("p", {
            class: "summary-pct",
            text: `${Math.round(result.completionPct)}% delivered`,
          }),
          el("div", { class: "summary-stats" }, [
            el("span", { class: "summary-stat ok", text: `🚂 ${delivered} delivered` }),
            el("span", { class: "summary-stat bad", text: `💥 ${lost} lost` }),
          ]),
          el("div", { class: "summary-unlocks" }, unlockRow),
          el("div", { class: "summary-actions" }, actions),
        ]),
      ],
    );

    // Esc is handled by the buttons only; don't let it silently dismiss the results.
    dialog.addEventListener("cancel", (e) => e.preventDefault());
    this.summaryEl = dialog;
    this.root.appendChild(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  _closeSummary() {
    if (!this.summaryEl) return;
    if (typeof this.summaryEl.close === "function" && this.summaryEl.open) this.summaryEl.close();
    this.summaryEl.remove();
    this.summaryEl = null;
  }

  retry() {
    this._closeSummary();
    this._stopLoop();
    this.finished = false;
    this.running = false;
    this.model = new GameModel();
    this.model.setEventSink((e) => this.app.audio.onEvent(e));
    this.model.loadLevel(this.levelDef);
    this.rotateHex = null;
    if (this.rotateBtn) this.rotateBtn.style.display = "none";
    this._restoreInProgress();
    this.app._gameHooks.tapHex = (q, r) => this._placeStraight({ q, r });
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
    this._closeSummary();
    this._stopLoop();
    this._nowPlaying?.dispose();
    if (this._onKeyDown) window.removeEventListener("keydown", this._onKeyDown);
  }
}
