// Tiny synthesized sound effects (no audio files). Quiet by default and
// mutable; the choice is remembered on this device.

let ctx = null;
let master = null;
let muted = false;

try {
  muted = localStorage.getItem("orb.muted") === "1";
} catch {
  /* storage blocked */
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem("orb.muted", value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Don't machine-gun the same sound when things jitter against each other.
const lastPlayed = {};
function ready(name, gap = 0.08) {
  if (muted) return null;
  const a = audio();
  if (!a) return null;
  if (lastPlayed[name] && a.currentTime - lastPlayed[name] < gap) return null;
  lastPlayed[name] = a.currentTime;
  return a;
}

function tone(a, { type = "sine", from, to, duration, volume = 0.5, delay = 0 }) {
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(a, { duration, volume = 0.4, filter = 2000, delay = 0 }) {
  const t = a.currentTime + delay;
  const length = Math.floor(a.sampleRate * duration);
  const buffer = a.createBuffer(1, length, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = filter;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(bp).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  squeak() {
    const a = ready("squeak", 0.15);
    if (!a) return;
    tone(a, { type: "triangle", from: 900, to: 1700, duration: 0.09, volume: 0.35 });
    tone(a, { type: "triangle", from: 1700, to: 1100, duration: 0.1, volume: 0.3, delay: 0.08 });
  },
  boing() {
    const a = ready("boing", 0.12);
    if (!a) return;
    tone(a, { type: "sine", from: 180, to: 520, duration: 0.35, volume: 0.45 });
  },
  crack() {
    const a = ready("crack");
    if (!a) return;
    noise(a, { duration: 0.12, volume: 0.6, filter: 3500 });
  },
  shatter() {
    const a = ready("shatter");
    if (!a) return;
    noise(a, { duration: 0.35, volume: 0.5, filter: 5000 });
    tone(a, { type: "triangle", from: 2400, to: 1800, duration: 0.25, volume: 0.15 });
  },
  pop() {
    const a = ready("pop");
    if (!a) return;
    tone(a, { type: "square", from: 300, to: 900, duration: 0.07, volume: 0.15 });
  },
  ribbit() {
    const a = ready("ribbit", 0.3);
    if (!a) return;
    tone(a, { type: "sawtooth", from: 140, to: 110, duration: 0.09, volume: 0.18 });
    tone(a, { type: "sawtooth", from: 160, to: 120, duration: 0.11, volume: 0.18, delay: 0.12 });
  },
  whoosh() {
    const a = ready("whoosh", 0.3);
    if (!a) return;
    noise(a, { duration: 0.6, volume: 0.35, filter: 700 });
  },
  beam() {
    const a = ready("beam", 0.6);
    if (!a) return;
    tone(a, { type: "sine", from: 300, to: 1200, duration: 0.8, volume: 0.2 });
  },
  coo() {
    const a = ready("coo", 0.4);
    if (!a) return;
    tone(a, { type: "sine", from: 420, to: 330, duration: 0.25, volume: 0.25 });
  },
  slip() {
    const a = ready("slip", 0.4);
    if (!a) return;
    tone(a, { type: "sine", from: 900, to: 200, duration: 0.4, volume: 0.25 });
  },
  boo() {
    const a = ready("boo", 0.4);
    if (!a) return;
    tone(a, { type: "sine", from: 260, to: 180, duration: 0.6, volume: 0.25 });
  },
};
