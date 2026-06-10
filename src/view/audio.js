// Web Audio SFX + music. Browser-only. Synthesizes simple tones so no asset files are
// required for the harness; volume/mute honor settings. Listens via View.onEvent. (FR-042, FR-043)

import { View, ViewEvent } from "./view-abstraction.js";

const SFX = {
  [ViewEvent.DEPART]: { freq: 440, dur: 0.12, type: "triangle" },
  [ViewEvent.ARRIVE]: { freq: 660, dur: 0.18, type: "sine" },
  [ViewEvent.CRASH]: { freq: 120, dur: 0.3, type: "sawtooth" },
  [ViewEvent.SWITCH_TOGGLE]: { freq: 520, dur: 0.07, type: "square" },
  [ViewEvent.PLACE]: { freq: 300, dur: 0.05, type: "square" },
  [ViewEvent.ROTATE]: { freq: 360, dur: 0.05, type: "square" },
};

export class AudioView extends View {
  constructor(settings = {}) {
    super();
    this.settings = {
      musicVolume: 0.8,
      sfxVolume: 1.0,
      musicMuted: false,
      sfxMuted: false,
      ...settings,
    };
    this.ctx = null;
    this.musicGain = null;
    this.musicOsc = null;
    this.lastEvent = null;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (this.musicGain) {
      this.musicGain.gain.value = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.06;
    }
  }

  startMusic() {
    this._ensureContext();
    if (!this.ctx || this.musicOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 110;
    gain.gain.value = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.06;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this.musicOsc = osc;
    this.musicGain = gain;
  }

  stopMusic() {
    if (this.musicOsc) {
      try {
        this.musicOsc.stop();
      } catch {
        /* ignore */
      }
      this.musicOsc = null;
      this.musicGain = null;
    }
  }

  onEvent(event) {
    this.lastEvent = event;
    if (this.settings.sfxMuted) return;
    const spec = SFX[event.type];
    if (!spec) return;
    this._ensureContext();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    const vol = this.settings.sfxVolume;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(vol * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + spec.dur);
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close?.();
      this.ctx = null;
    }
  }
}
