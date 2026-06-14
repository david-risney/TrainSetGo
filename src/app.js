// App bootstrap + screen router. Wires the deterministic model to the view/UI/persistence.
// Exposes window.TrainSetGo as a stable test surface for end-to-end tests. (FR-041)

import { GameModel } from "./model/simulation.js";
import { SaveStore, updateBestResult, applyUnlocks } from "./model/save.js";
import { evaluateUnlocks } from "./model/unlock.js";
import { Renderer, hexToWorld } from "./view/renderer.js";
import { AudioView } from "./view/audio.js";
import { InputController } from "./view/input.js";
import { MenuScreen } from "./ui/menu.js";
import { OverworldScreen } from "./ui/overworld.js";
import { GameScreen } from "./ui/game-screen.js";
import { EditorScreen } from "./ui/editor.js";
import { SettingsScreen } from "./ui/settings.js";

export class GameApp {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.levels = new Map(); // id -> level def
    this.manifest = null;
    this.renderer = new Renderer(canvas);
    this.audio = new AudioView();
    this.save = null;
    this.state = null;
    this.currentScreen = null;
    this.editorLevel = null; // a level authored in the editor, ready to play

    this.input = new InputController(canvas, {
      onTap: (x, y) => this.currentScreen?.onTap?.(x, y),
      onPan: (dx, dy) => {
        this.renderer.camera.panBy(dx, dy);
        this.requestRender();
      },
      onZoom: (factor, cx, cy) => {
        this.renderer.zoomAt(factor, cx, cy);
        this.requestRender();
      },
      onRotate: (deltaRadians, cx, cy) => {
        this.renderer.rotateAt(deltaRadians, cx, cy);
        this.requestRender();
      },
    });

    window.addEventListener("resize", () => this.renderer.resize());

    // Client-side routing: each view has its own URL (/, /overworld, /stage/{id},
    // /editor, /settings). Back/forward navigation replays the matching screen.
    window.addEventListener("popstate", () => {
      this._applyRoute(this._routeFromLocation());
    });
  }

  async init() {
    this.manifest = await fetchJSON("src/levels/campaign.json");
    await Promise.all(
      this.manifest.levels.map(async (entry) => {
        const def = await fetchJSON(`src/levels/${entry.file}`);
        this.levels.set(entry.id, def);
      }),
    );
    this.save = new SaveStore(window.localStorage, this.manifest);
    this.state = this.save.load();
    this.audio.applySettings(this.state.settings);
    await this.audio.load();
    this._applyRoute(this._routeFromLocation());
  }

  persist() {
    this.save.save(this.state);
  }

  requestRender(snapshot) {
    if (snapshot) this.renderer.render(snapshot);
    else if (this.renderer.lastSnapshot) this.renderer.render(this.renderer.lastSnapshot);
    this.currentScreen?.afterRender?.();
  }

  clearUI() {
    this.currentScreen?.dispose?.();
    this.uiRoot.innerHTML = "";
    this.currentScreen = null;
  }

  setScreen(screen) {
    this.clearUI();
    this.currentScreen = screen;
    screen.mount(this.uiRoot);
  }

  // --- Screen navigation ---
  showMenu() {
    this._setURL("/");
    this.renderer.render(null);
    this.setScreen(new MenuScreen(this));
  }

  showOverworld() {
    this._setURL("/overworld");
    this.setScreen(new OverworldScreen(this));
  }

  showGame(levelId, levelDef = null) {
    this._setURL(`/stage/${encodeURIComponent(levelId)}`);
    const def = levelDef ?? this.levels.get(levelId);
    this.setScreen(new GameScreen(this, def));
  }

  showEditor() {
    this._setURL("/editor");
    this.setScreen(new EditorScreen(this));
  }

  showSettings() {
    this._setURL("/settings");
    this.setScreen(new SettingsScreen(this));
  }

  // --- Routing ---
  // Map the current location to a route descriptor.
  _routeFromLocation() {
    const path = (window.location?.pathname || "/").replace(/\/+$/, "") || "/";
    if (path === "/overworld") return { name: "overworld" };
    if (path === "/editor") return { name: "editor" };
    if (path === "/settings") return { name: "settings" };
    const stage = path.match(/^\/stage\/(.+)$/);
    if (stage) return { name: "stage", id: decodeURIComponent(stage[1]) };
    return { name: "menu" };
  }

  // Show the screen for a route without pushing history (the URL already matches).
  _applyRoute(route) {
    switch (route.name) {
      case "overworld":
        this.showOverworld();
        break;
      case "editor":
        this.showEditor();
        break;
      case "settings":
        this.showSettings();
        break;
      case "stage":
        if (this.levels.has(route.id)) this.showGame(route.id);
        else this.showMenu();
        break;
      default:
        this.showMenu();
    }
  }

  // Push a new history entry only when the path actually changes (so _applyRoute,
  // invoked from popstate or boot, doesn't create a redundant entry).
  _setURL(path) {
    if (typeof window === "undefined" || !window.history) return;
    const norm = (p) => p.replace(/\/+$/, "") || "/";
    if (norm(window.location.pathname) === norm(path)) return;
    window.history.pushState({}, "", path);
  }

  isUnlocked(levelId) {
    return this.state.unlockedLevelIds.includes(levelId);
  }

  // Record a completed run: update best result, apply unlocks, persist.
  recordResult(levelDef, result) {
    updateBestResult(this.state, result);
    const unlocked = evaluateUnlocks(levelDef.unlockRules ?? [], result);
    applyUnlocks(this.state, unlocked);
    // Clear in-progress for this level once a run resolves.
    if (this.state.inProgress?.levelId === levelDef.id) this.state.inProgress = null;
    this.persist();
    return unlocked;
  }

  saveInProgress(levelId, tilePlacements, switchStates) {
    this.state.inProgress = { levelId, tilePlacements, switchStates };
    this.persist();
  }

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.audio.applySettings(this.state.settings);
    this.persist();
  }
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// --- Bootstrap + test API ---
async function boot() {
  const canvas = document.getElementById("scene");
  const uiRoot = document.getElementById("ui-root");
  const app = new GameApp(canvas, uiRoot);
  await app.init();

  window.TrainSetGo = {
    app,
    GameModel,
    state: () => app.state,
    goMenu: () => app.showMenu(),
    goOverworld: () => app.showOverworld(),
    goEditor: () => app.showEditor(),
    goSettings: () => app.showSettings(),
    playLevel: (id) => app.showGame(id),
    currentModel: () => app.currentScreen?.model ?? null,
    tapHex: (q, r) => app._gameHooks?.tapHex(q, r),
    runLevel: () => app._gameHooks?.run(),
    retryLevel: () => app._gameHooks?.retry(),
    camera: () => app.renderer.camera.get(),
    hexToScreen: (q, r) => app.renderer.worldToScreen(hexToWorld(q, r)),
    screenToHex: (x, y) => app.renderer.screenToHex(x, y),
    editorSelectTool: (group, value) => app._editorHooks?.selectTool(group, value),
    editorTapHex: (q, r) => app._editorHooks?.tapHex(q, r),
    editorPlay: () => app._editorHooks?.play(),
    lastAudioEvent: () => app.audio.lastEvent,
  };
  window.dispatchEvent(new Event("trainsetgo:ready"));
}

if (typeof document !== "undefined") {
  boot().catch((err) => {
    console.error(err);
    const root = document.getElementById("ui-root");
    if (root) root.innerHTML = `<pre style="color:#f88;padding:1rem">${String(err)}</pre>`;
  });
}
