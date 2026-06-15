// Audio: streams Creative Commons music (mp3) and plays sound-effect files (wav), with a
// synthesized fallback when assets are missing or cannot be decoded (e.g. offline). The
// model stays DOM-free and drives this via View.onEvent. (FR-042, FR-043)
//
// Music is coordinated by scene: the menu/overworld plays the manifest's `menuMusic`
// playlist, and each level plays the track named by its `music` field. A small pub/sub
// (`onMusicChange`) lets the "now playing" UI track the current song and play state.

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
    this.musicEl = null; // HTMLAudioElement (reused across tracks)
    this.sfxBuffers = new Map(); // event type -> AudioBuffer

    // Music coordination state.
    this.musicTracks = []; // [{ id, file, title, author, ... }]
    this._musicById = new Map(); // id -> track meta
    this.playlist = []; // current scene playlist (array of track ids)
    this.playlistIndex = 0;
    this.currentTrackId = null;
    this._playing = false;
    this._musicListeners = new Set();

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

    // Index the music tracks for scene coordination.
    this.musicTracks = Array.isArray(this.manifest.music) ? this.manifest.music : [];
    this._musicById = new Map(this.musicTracks.map((t) => [t.id, t]));

    // One reusable <audio> element streams whichever track is current. We advance the
    // playlist when a track ends (a single-track playlist simply replays, i.e. loops).
    if (this.musicTracks.length && typeof Audio !== "undefined") {
      try {
        const el = new Audio();
        el.preload = "auto";
        el.addEventListener("ended", () => this.nextTrack());
        el.addEventListener("play", () => this._setPlaying(true));
        el.addEventListener("playing", () => this._setPlaying(true));
        el.addEventListener("pause", () => this._setPlaying(false));
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

  // --- Now-playing pub/sub ---------------------------------------------------
  // Subscribe to music changes (track switch, play/pause, mute). Returns an
  // unsubscribe function.
  onMusicChange(fn) {
    this._musicListeners.add(fn);
    return () => this._musicListeners.delete(fn);
  }

  _emitMusicChange() {
    for (const fn of this._musicListeners) {
      try {
        fn();
      } catch {
        /* a listener error must not break audio */
      }
    }
  }

  _setPlaying(v) {
    if (this._playing === v) return;
    this._playing = v;
    this._emitMusicChange();
  }

  // The current track's metadata, or null.
  nowPlaying() {
    return this._musicById.get(this.currentTrackId) ?? null;
  }

  // True while music is "on" (a track is scheduled and not muted). Optimistic so the
  // now-playing disc spins even if the browser defers actual playback until the first
  // user gesture (autoplay policy).
  isMusicPlaying() {
    return !!this.currentTrackId && !this.settings.musicMuted;
  }

  isMusicMuted() {
    return !!this.settings.musicMuted;
  }

  // --- Scene coordination ----------------------------------------------------
  // Normalize a `music` field (string | string[] | undefined) to a list of ids.
  _normalizeIds(ids) {
    if (Array.isArray(ids)) return ids;
    if (typeof ids === "string") return [ids];
    return [];
  }

  _sameList(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  // Play the menu/overworld playlist (no-op restart if already playing it).
  playMenuMusic() {
    this.playPlaylist(this._normalizeIds(this.manifest?.menuMusic));
  }

  // Play the music for a level (its `music` field).
  playLevelMusic(musicField) {
    this.playPlaylist(this._normalizeIds(musicField));
  }

  // Set the active playlist and start it. Unknown ids are dropped; an empty result
  // falls back to all known tracks. If the requested playlist matches what is already
  // playing, playback continues uninterrupted (so moving between menu screens doesn't
  // restart the song).
  playPlaylist(ids) {
    const valid = this._normalizeIds(ids).filter((id) => this._musicById.has(id));
    const list = valid.length ? valid : this.musicTracks.map((t) => t.id);

    if (this._sameList(list, this.playlist) && this.currentTrackId) {
      this.startMusic();
      return;
    }
    this.playlist = list;
    this.playlistIndex = 0;
    this._playCurrent();
  }

  // Advance to the next track in the current playlist (wraps; replays a lone track).
  nextTrack() {
    if (!this.playlist.length) return;
    this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length;
    this._playCurrent();
  }

  _playCurrent() {
    const id = this.playlist[this.playlistIndex] ?? null;
    this.currentTrackId = id;
    const track = id ? this._musicById.get(id) : null;

    // Stop any synth drone from a previous fallback track.
    this._stopSynthDrone();

    if (this.musicEl && track) {
      try {
        this.musicEl.src = `${this.basePath}/${track.file}`;
        this.musicEl.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
        const p = this.musicEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        // Fall back to a drone if playback throws synchronously.
        this._startSynthDrone(id);
      }
    } else {
      // No <audio> support or missing file: a soft synthesized drone keyed to the track.
      this._startSynthDrone(id);
    }
    this._emitMusicChange();
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (this.musicEl) {
      this.musicEl.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.06;
    }
    // Mute state affects whether the now-playing disc should appear to spin.
    this._emitMusicChange();
  }

  // Resume/ensure the current track is playing (used after a user gesture).
  startMusic() {
    if (this.musicEl && this.currentTrackId) {
      this.musicEl.volume = this.settings.musicMuted ? 0 : this.settings.musicVolume;
      const p = this.musicEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      return;
    }
    if (this.playlist.length) {
      this._playCurrent();
      return;
    }
    // Nothing scheduled yet: a single soft synthesized drone.
    this._startSynthDrone(null);
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
    this._stopSynthDrone();
    this._setPlaying(false);
  }

  _startSynthDrone(id) {
    this._ensureContext();
    if (!this.ctx || this.musicOsc) return;
    // Derive a pitch from the track id so different tracks sound distinct.
    let h = 0;
    for (const ch of String(id ?? "")) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const freq = 90 + (Math.abs(h) % 7) * 15;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = this.settings.musicMuted ? 0 : this.settings.musicVolume * 0.06;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    this.musicOsc = osc;
    this.musicGain = gain;
    this._setPlaying(true);
  }

  _stopSynthDrone() {
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
    this._musicListeners.clear();
    if (this.ctx) {
      this.ctx.close?.();
      this.ctx = null;
    }
  }
}
