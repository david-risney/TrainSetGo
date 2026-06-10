// One-off generator for CC0 sound-effect WAV files (self-authored, public domain).
// Run with: node scripts/gen-sfx.mjs   (outputs into src/assets/audio/sfx)
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "src", "assets", "audio", "sfx");
mkdirSync(outDir, { recursive: true });

const RATE = 22050;

function render(durationSec, fn) {
  const n = Math.floor(RATE * durationSec);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = fn(i / RATE, i, n);
  return samples;
}

function encodeWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const env = (t, dur, attack = 0.005) => {
  const a = Math.min(1, t / attack);
  const d = Math.max(0, 1 - (t - attack) / (dur - attack));
  return a * d * d;
};
const tone = (freq, type = "sine") => (t) => {
  const phase = 2 * Math.PI * freq * t;
  switch (type) {
    case "square":
      return Math.sign(Math.sin(phase));
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "saw":
      return 2 * (freq * t - Math.floor(0.5 + freq * t));
    default:
      return Math.sin(phase);
  }
};

const specs = {
  depart: { dur: 0.18, build: (t, dur) => tone(330 + 220 * (t / dur), "triangle")(t) * env(t, dur) * 0.5 },
  arrive: { dur: 0.28, build: (t, dur) => (tone(660, "sine")(t) + 0.5 * tone(990, "sine")(t)) * env(t, dur) * 0.4 },
  crash: {
    dur: 0.35,
    build: (t, dur) => ((Math.random() * 2 - 1) * 0.6 + tone(90, "saw")(t)) * env(t, dur, 0.001) * 0.5,
  },
  switch: { dur: 0.08, build: (t, dur) => tone(520, "square")(t) * env(t, dur, 0.001) * 0.35 },
  place: { dur: 0.07, build: (t, dur) => tone(300, "square")(t) * env(t, dur, 0.001) * 0.4 },
  rotate: { dur: 0.07, build: (t, dur) => tone(380, "square")(t) * env(t, dur, 0.001) * 0.4 },
};

for (const [name, spec] of Object.entries(specs)) {
  const samples = render(spec.dur, (t) => spec.build(t, spec.dur));
  writeFileSync(join(outDir, `${name}.wav`), encodeWav(samples));
  console.log(`wrote ${name}.wav (${spec.dur}s)`);
}
