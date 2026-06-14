// Audio: streams Creative Commons music (mp3) and plays sound-effect files (wav), with a
// synthesized fallback when assets are missing or cannot be decoded (e.g. offline). The
// model stays DOM-free and drives this via View.onEvent. (FR-042, FR-043)

import { View, ViewEvent } from "./view-abstraction.js";

// Synthesized fallback specs, used when a sound file is unavailable.
const SFX_FALLBACK = {
  [ViewEvent.PRODUCE]: { freq: 392, dur: 0.1, type: "sine" },
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
    this.lastEvent = null;

    // File-backed assets (populated by load()).
    this.basePath = "src/assets/audio";
    this.manifest = null;
    this.musicEl = null; // HTMLAudioElement
    this.sfxBuffers = new Map(); // event type -> AudioBuffer

    // Synth fallback handles.
    this.musicOsc = null;
    this.musicGain = null;
  }

  _ensureContext() {
    if (this.ctx) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
  }

  // Load the manifest, prepare the music element, and decode SFX buffers. Any failure
  // leaves the corresponding fallback in place; never throws.
  async load(basePath = this.basePath) {
    this.basePath = basePath;
    try {
      const res = await fetch(`${basePath}/manifest.json`);
      if (!res.ok) return;
      this.manifest = await res.json();
    } catch {
      return;
    }

    // Music: stream the first track via an <audio> element (loops).
    const track = this.manifest.music?.[0];
    if (track && typeof Audio !== "undefined") {
      try {
        const el = new Audio(`${basePath}/${track.file}`);
        el.loop = true;
        el.preload = "auto";
        el.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
        this.musicEl = el;
      } catch {
        this.musicEl = null;
      }
    }

    // SFX: fetch + decode each into an AudioBuffer.
    this._ensureContext();
    if (this.ctx && this.manifest.sfx) {
      await Promise.all(
        Object.entries(this.manifest.sfx).map(async ([type, file]) => {
          try {
            const r = await fetch(`${basePath}/${file}`);
            if (!r.ok) return;
            const data = await r.arrayBuffer();
            const buffer = await this.ctx.decodeAudioData(data);
            this.sfxBuffers.set(type, buffer);
          } catch {
            /* keep synth fallback for this effect */
          }
        }),
      );
    }
  }

  attribution() {
    return this.manifest?.attribution ?? "";
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (this.musicEl) {
      this.musicEl.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.06;
    }
  }

  startMusic() {
    if (this.musicEl) {
      this.musicEl.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
      const p = this.musicEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      return;
    }
    // Fallback: a single soft synthesized drone.
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
    if (this.musicEl) {
      try {
        this.musicEl.pause();
        this.musicEl.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
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

    const buffer = this.sfxBuffers.get(event.type);
    if (buffer && this.ctx) {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = this.settings.sfxVolume;
      src.buffer = buffer;
      src.connect(gain).connect(this.ctx.destination);
      src.start();
      return;
    }

    this._playSynthSfx(event.type);
  }

  _playSynthSfx(type) {
    const spec = SFX_FALLBACK[type];
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
