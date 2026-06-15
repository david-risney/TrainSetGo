// Settings screen: music/sfx volume + mute, persisted. (FR-043)

import { button, el } from "./dom.js";
import { BACKGROUNDS } from "../view/background.js";

export class SettingsScreen {
  constructor(app) {
    this.app = app;
    this.model = null;
  }

  mount(root) {
    this.app.audio.playMenuMusic();
    const s = this.app.state.settings;
    const panel = el("div", { class: "screen settings-panel", "data-testid": "screen-settings" }, [
      el("h2", { text: "Settings" }),
      this._slider("Music volume", "music-volume", s.musicVolume, (v) =>
        this.app.updateSettings({ musicVolume: v }),
      ),
      this._toggle("Mute music", "music-mute", s.musicMuted, (v) =>
        this.app.updateSettings({ musicMuted: v }),
      ),
      this._slider("Sound effects volume", "sfx-volume", s.sfxVolume, (v) =>
        this.app.updateSettings({ sfxVolume: v }),
      ),
      this._toggle("Mute sound effects", "sfx-mute", s.sfxMuted, (v) =>
        this.app.updateSettings({ sfxMuted: v }),
      ),
      this._select("Menu background", "menu-background", BACKGROUNDS, s.menuBackground, (v) =>
        this.app.updateSettings({ menuBackground: v }),
      ),
      button("Back", {
        class: "btn",
        "data-testid": "btn-back",
        onClick: () => this.app.showOverworld(),
      }),
      el("p", {
        class: "status-line credits",
        "data-testid": "audio-credits",
        text: this.app.audio.attribution(),
      }),
    ]);
    root.appendChild(panel);
  }

  _slider(label, testid, value, onChange) {
    const input = el("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.05",
      value: String(value),
      "data-testid": testid,
    });
    input.addEventListener("input", () => onChange(Number(input.value)));
    return el("div", { class: "row" }, [el("label", { text: label }), input]);
  }

  _toggle(label, testid, checked, onChange) {
    const input = el("input", { type: "checkbox", "data-testid": testid });
    input.checked = !!checked;
    input.addEventListener("change", () => onChange(input.checked));
    return el("div", { class: "row" }, [el("label", { text: label }), input]);
  }

  _select(label, testid, options, value, onChange) {
    const select = el(
      "select",
      { class: "select", "data-testid": testid },
      options.map((o) => el("option", { value: o.id, text: o.name })),
    );
    select.value = value;
    select.addEventListener("change", () => onChange(select.value));
    return el("div", { class: "row" }, [el("label", { text: label }), select]);
  }

  dispose() {}
}
