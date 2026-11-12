/**
 * All sound is synthesised with the Web Audio API (no audio files). The music is rendered once into a buffer with an
 * OfflineAudioContext (its ringing tail is folded back onto the start, so the loop is seamless) and normalised, so
 * its volume is the same every time. Sound effects are small synth voices played live.
 */

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let music: AudioBuffer | null = null;
let musicSrc: AudioBufferSourceNode | null = null;
let rendering: Promise<AudioBuffer | null> | null = null;
let muted = false;
let sfxOn = true;
let musicOn = true;
let wantMusic = false;

const MUSIC_GAIN = 0.34;
const SFX_GAIN = 0.7;

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(comp);
      musicBus.connect(comp);
      noise = makeNoise(ctx);
      applyGains();
    } catch {
      ctx = null;
    }
  }
  // resume() rejects on a closed context (and can throw): never an unhandled rejection from a tap
  if (ctx?.state === 'suspended') {
    try {
      ctx.resume().catch(() => {});
    } catch {
      /* play on silently */
    }
  }
  if (wantMusic) void startMusic();
}

function makeNoise(c: BaseAudioContext) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return b;
}

function applyGains() {
  if (!ctx || !sfxBus || !musicBus) return;
  sfxBus.gain.setTargetAtTime(muted || !sfxOn ? 0 : SFX_GAIN, ctx.currentTime, 0.02);
  musicBus.gain.setTargetAtTime(muted || !musicOn ? 0 : MUSIC_GAIN, ctx.currentTime, 0.08);
}

export function setMuted(m: boolean) {
  muted = m;
  applyGains();
}
export function setSfx(on: boolean) {
  sfxOn = on;
  applyGains();
}
export function setMusic(on: boolean) {
  musicOn = on;
  applyGains();
}

/* ---------------------------------------------------------------- music */

const BPM = 104;
const BEAT = 60 / BPM;
const BARS = 16;
const LOOP = BARS * 4 * BEAT;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

// C major: I V vi IV | I V IV V, twice (the second time with a brighter melody)
const CHORDS: number[][] = [
  [48, 52, 55],
  [43, 47, 50],
  [45, 48, 52],
  [41, 45, 48],
  [48, 52, 55],
  [43, 47, 50],
  [41, 45, 48],
  [43, 47, 50],
];
// melody: [beat offset in bar, midi, length in beats] per bar (8 bars, played twice; the 2nd pass an octave mix)
const MELODY: [number, number, number][][] = [
  [[0, 72, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 76, 1], [3, 74, 1]],
  [[0, 74, 1.5], [1.5, 71, 0.5], [2, 67, 2]],
  [[0, 69, 1], [1, 72, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 72, 1]],
  [[0, 72, 1.5], [1.5, 69, 0.5], [2, 65, 1], [3, 69, 1]],
  [[0, 72, 0.5], [0.5, 74, 0.5], [1, 76, 1], [2, 79, 1], [3, 81, 1]],
  [[0, 79, 1.5], [1.5, 76, 0.5], [2, 74, 1], [3, 71, 1]],
  [[0, 72, 1], [1, 69, 0.5], [1.5, 72, 0.5], [2, 77, 1], [3, 76, 1]],
  [[0, 74, 2], [2, 71, 1], [3, 74, 1]],
];

function voice(c: BaseAudioContext, dest: AudioNode, t: number, f: number, dur: number, o: { type?: OscillatorType; gain?: number; a?: number; r?: number; lp?: number; detune?: number }) {
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.value = f;
  if (o.detune) osc.detune.value = o.detune;
  const g = c.createGain();
  const a = o.a ?? 0.01,
    r = o.r ?? 0.2,
    peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0, t + Math.max(a, dur), r / 3);
  let out: AudioNode = g;
  if (o.lp) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lp;
    g.connect(lp);
    out = lp;
  }
  osc.connect(g);
  out.connect(dest);
  osc.start(t);
  osc.stop(t + dur + r * 2 + 0.05);
}

/** a soft mallet (two partials, fast decay) */
function mallet(c: BaseAudioContext, dest: AudioNode, t: number, m: number, len: number, gain: number) {
  const f = mtof(m);
  voice(c, dest, t, f, 0.02, { type: 'sine', gain, a: 0.004, r: Math.min(1.2, 0.35 + len * 0.3) });
  voice(c, dest, t, f * 4, 0.01, { type: 'sine', gain: gain * 0.18, a: 0.002, r: 0.12 });
  voice(c, dest, t, f * 2, 0.02, { type: 'triangle', gain: gain * 0.25, a: 0.004, r: 0.3 });
}

function noiseHit(c: BaseAudioContext, dest: AudioNode, buf: AudioBuffer, t: number, o: { gain: number; f: number; q?: number; dur: number; type?: BiquadFilterType }) {
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.value = o.f;
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, (t * 7.31) % 0.8);
  src.stop(t + o.dur + 0.02);
}

async function renderMusic(): Promise<AudioBuffer | null> {
  const rate = 32000;
  const tail = 2;
  const len = Math.ceil((LOOP + tail) * rate);
  let c: OfflineAudioContext;
  try {
    c = new OfflineAudioContext(2, len, rate);
  } catch {
    return null;
  }
  const buf = makeNoise(c);
  const out = c.createGain();
  out.connect(c.destination);
  // a little stereo width: pads left-ish, arp right-ish
  const panL = c.createStereoPanner();
  panL.pan.value = -0.35;
  panL.connect(out);
  const panR = c.createStereoPanner();
  panR.pan.value = 0.35;
  panR.connect(out);
  for (let bar = 0; bar < BARS; bar++) {
    const t0 = bar * 4 * BEAT;
    const chord = CHORDS[bar % 8];
    const second = bar >= 8;
    // pad
    for (const m of chord) {
      voice(c, panL, t0, mtof(m + 12), 4 * BEAT - 0.1, { type: 'triangle', gain: 0.045, a: 0.5, r: 0.8, lp: 1400, detune: -6 });
      voice(c, panR, t0, mtof(m + 12), 4 * BEAT - 0.1, { type: 'triangle', gain: 0.045, a: 0.5, r: 0.8, lp: 1400, detune: 6 });
    }
    // bass: root on 1, fifth on 3, passing note on 4+
    const root = chord[0] - 12;
    voice(c, out, t0, mtof(root), BEAT * 1.6, { type: 'sine', gain: 0.32, a: 0.01, r: 0.25 });
    voice(c, out, t0 + 2 * BEAT, mtof(root + 7), BEAT * 1.2, { type: 'sine', gain: 0.26, a: 0.01, r: 0.25 });
    voice(c, out, t0 + 3.5 * BEAT, mtof(root + 12), BEAT * 0.4, { type: 'sine', gain: 0.18, a: 0.01, r: 0.15 });
    // arp in eighths
    for (let i = 0; i < 8; i++) {
      const m = chord[[0, 1, 2, 1, 0, 2, 1, 2][i]] + 24;
      mallet(c, panR, t0 + i * BEAT * 0.5, m, 0.5, i % 2 ? 0.035 : 0.05);
    }
    // melody
    for (const [b, m, l] of MELODY[bar % 8]) mallet(c, out, t0 + b * BEAT, m + (second && bar % 2 === 0 ? 0 : 0), l, second ? 0.13 : 0.11);
    if (second) for (const [b, m, l] of MELODY[bar % 8]) mallet(c, panL, t0 + b * BEAT + 0.01, m - 12, l, 0.04);
    // drums: soft kick on 1 and 3, rim on 2 and 4, shaker eighths
    for (let beat = 0; beat < 4; beat++) {
      const tb = t0 + beat * BEAT;
      if (beat % 2 === 0) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.setValueAtTime(130, tb);
        o.frequency.exponentialRampToValueAtTime(45, tb + 0.12);
        g.gain.setValueAtTime(0.38, tb);
        g.gain.exponentialRampToValueAtTime(0.001, tb + 0.22);
        o.connect(g).connect(out);
        o.start(tb);
        o.stop(tb + 0.25);
      } else noiseHit(c, out, buf, tb, { gain: 0.12, f: 1800, q: 1.2, dur: 0.09 });
      noiseHit(c, panR, buf, tb, { gain: 0.04, f: 7000, q: 0.8, dur: 0.04, type: 'highpass' });
      noiseHit(c, panR, buf, tb + BEAT / 2, { gain: 0.05, f: 7500, q: 0.8, dur: 0.05, type: 'highpass' });
    }
  }
  const res = await c.startRendering();
  // fold the tail back onto the start (seamless loop) and normalise
  const n = Math.round(LOOP * rate);
  const looped = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: rate });
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const src = res.getChannelData(ch);
    const dst = looped.getChannelData(ch);
    for (let i = 0; i < n; i++) dst[i] = src[i] + (i + n < src.length ? src[i + n] : 0);
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(dst[i]));
  }
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let ch = 0; ch < 2; ch++) {
    const d = looped.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return looped;
}

/** start rendering the music early (it needs no user gesture) */
export function prepareMusic() {
  // a failed render is no music, never a rejection nobody handles
  rendering ??= renderMusic()
    .catch(() => null)
    .then((b) => (music = b));
  return rendering;
}

export async function startMusic() {
  wantMusic = true;
  if (!ctx || !musicBus || musicSrc) return;
  await prepareMusic();
  if (!music || musicSrc || !ctx || ctx.state === 'closed') return;
  try {
    musicSrc = ctx.createBufferSource();
    musicSrc.buffer = music;
    musicSrc.loop = true;
    musicSrc.connect(musicBus);
    musicSrc.start();
  } catch {
    musicSrc = null;
  }
}

/* ---------------------------------------------------------------- effects */

type Sfx =
  | 'jump'
  | 'land'
  | 'gem'
  | 'acorn'
  | 'hit'
  | 'ouch'
  | 'stomp'
  | 'grow'
  | 'bounce'
  | 'climb'
  | 'splash'
  | 'bonk'
  | 'thorns'
  | 'card'
  | 'click'
  | 'win'
  | 'checkpoint'
  | 'duck'
  | 'fall'
  | 'lose'
  | 'stop'
  | 'glide'
  | 'roll'
  | 'buy'
  | 'reward'
  | 'grab'
  | 'boar'
  | 'crack';

let gemStreak = 0;
let lastGem = 0;

export function sfx(name: Sfx) {
  try {
    playSfx(name);
  } catch {
    /* a closed / broken AudioContext: the game goes on silently */
  }
}

function playSfx(name: Sfx) {
  const c = ctx;
  const out = sfxBus;
  if (!c || !out || !noise || muted || !sfxOn || c.state === 'closed') return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'jump': {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(720, t + 0.13);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      break;
    }
    case 'land':
      noiseHit(c, out, noise, t, { gain: 0.2, f: 300, q: 0.7, dur: 0.09, type: 'lowpass' });
      break;
    case 'duck':
      noiseHit(c, out, noise, t, { gain: 0.16, f: 900, q: 0.6, dur: 0.25, type: 'lowpass' });
      break;
    case 'gem': {
      const now = performance.now();
      gemStreak = now - lastGem < 450 ? Math.min(gemStreak + 1, 10) : 0;
      lastGem = now;
      const m = 84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][gemStreak];
      mallet(c, out, t, m, 0.4, 0.16);
      voice(c, out, t + 0.05, mtof(m + 7), 0.02, { gain: 0.05, r: 0.2 });
      break;
    }
    case 'acorn':
      [72, 76, 79, 84, 88].forEach((m, i) => mallet(c, out, t + i * 0.07, m, 0.8, 0.18));
      voice(c, out, t + 0.35, mtof(96), 0.3, { gain: 0.04, a: 0.01, r: 0.8 });
      break;
    case 'checkpoint':
      [79, 84].forEach((m, i) => mallet(c, out, t + i * 0.09, m, 0.5, 0.12));
      break;
    case 'hit': {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      const lp = c.createBiquadFilter();
      lp.frequency.value = 1600;
      o.connect(lp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.32);
      break;
    }
    case 'ouch':
      // a short cartoon "oof": two falling notes and a soft thump
      voice(c, out, t, mtof(67), 0.09, { type: 'triangle', gain: 0.16, r: 0.08 });
      voice(c, out, t + 0.1, mtof(60), 0.16, { type: 'triangle', gain: 0.16, r: 0.18 });
      noiseHit(c, out, noise, t, { gain: 0.18, f: 260, q: 0.8, dur: 0.12, type: 'lowpass' });
      break;
    case 'stomp':
      noiseHit(c, out, noise, t, { gain: 0.3, f: 500, q: 1, dur: 0.12 });
      voice(c, out, t, 180, 0.05, { type: 'triangle', gain: 0.25, r: 0.1 });
      mallet(c, out, t + 0.06, 88, 0.3, 0.1);
      break;
    case 'grow':
      for (let i = 0; i < 8; i++) mallet(c, out, t + i * 0.09, [60, 64, 67, 72, 76, 79, 84, 88][i], 0.5, 0.06 + i * 0.012);
      noiseHit(c, out, noise, t, { gain: 0.18, f: 2500, q: 0.5, dur: 0.9 });
      voice(c, out, t + 0.75, mtof(91), 0.2, { gain: 0.06, a: 0.02, r: 0.9 });
      break;
    case 'bounce': {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.22);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.36);
      break;
    }
    case 'climb':
      for (let i = 0; i < 6; i++) noiseHit(c, out, noise, t + i * 0.18, { gain: 0.1, f: 1400 + i * 120, q: 2, dur: 0.06 });
      break;
    case 'splash':
      noiseHit(c, out, noise, t, { gain: 0.4, f: 1200, q: 0.4, dur: 0.6, type: 'lowpass' });
      [70, 66, 63].forEach((m, i) => voice(c, out, t + 0.2 + i * 0.12, mtof(m), 0.05, { gain: 0.09, r: 0.15 }));
      break;
    case 'bonk':
      voice(c, out, t, 210, 0.03, { type: 'triangle', gain: 0.35, r: 0.12 });
      noiseHit(c, out, noise, t, { gain: 0.25, f: 700, q: 3, dur: 0.1 });
      [91, 88, 91].forEach((m, i) => voice(c, out, t + 0.2 + i * 0.1, mtof(m), 0.02, { gain: 0.05, r: 0.08 }));
      break;
    case 'thorns':
      noiseHit(c, out, noise, t, { gain: 0.25, f: 3000, q: 4, dur: 0.15 });
      voice(c, out, t + 0.05, 600, 0.12, { type: 'triangle', gain: 0.14, r: 0.1 });
      voice(c, out, t + 0.17, 760, 0.12, { type: 'triangle', gain: 0.14, r: 0.15 });
      break;
    case 'card':
      mallet(c, out, t, 79, 0.2, 0.12);
      break;
    case 'click':
      voice(c, out, t, 900, 0.01, { type: 'triangle', gain: 0.12, r: 0.05 });
      break;
    case 'glide':
      noiseHit(c, out, noise, t, { gain: 0.18, f: 900, q: 0.5, dur: 0.8, type: 'lowpass' });
      [79, 76, 72].forEach((m, i) => mallet(c, out, t + i * 0.12, m, 0.6, 0.06));
      break;
    case 'roll':
      for (let i = 0; i < 5; i++) voice(c, out, t + i * 0.09, 110 + i * 6, 0.04, { type: 'triangle', gain: 0.12, r: 0.06 });
      break;
    case 'grab':
      noiseHit(c, out, noise, t, { gain: 0.14, f: 1800, q: 1.5, dur: 0.12 });
      mallet(c, out, t + 0.03, 79, 0.3, 0.08);
      break;
    case 'boar': {
      // a cartoon grunt: two low wobbling honks
      for (let i = 0; i < 2; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(120, t + i * 0.22);
        o.frequency.exponentialRampToValueAtTime(80, t + i * 0.22 + 0.18);
        g.gain.setValueAtTime(0.08, t + i * 0.22);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.22 + 0.2);
        const lp = c.createBiquadFilter();
        lp.frequency.value = 700;
        o.connect(lp).connect(g).connect(out);
        o.start(t + i * 0.22);
        o.stop(t + i * 0.22 + 0.22);
      }
      break;
    }
    case 'crack':
      noiseHit(c, out, noise, t, { gain: 0.3, f: 900, q: 2, dur: 0.18 });
      voice(c, out, t + 0.05, 140, 0.05, { type: 'triangle', gain: 0.2, r: 0.12 });
      break;
    case 'buy':
      [76, 79, 84, 88].forEach((m, i) => mallet(c, out, t + i * 0.06, m, 0.5, 0.14));
      break;
    case 'reward':
      [72, 79, 84, 91].forEach((m, i) => mallet(c, out, t + i * 0.08, m, 0.7, 0.15));
      break;
    case 'stop':
      [76, 72].forEach((m, i) => mallet(c, out, t + i * 0.1, m, 0.4, 0.1));
      break;
    case 'win':
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => mallet(c, out, t + i * 0.11, m, 0.8, 0.16));
      [60, 64, 67].forEach((m) => voice(c, out, t + 0.66, mtof(m), 0.8, { type: 'triangle', gain: 0.06, a: 0.05, r: 0.8 }));
      break;
    case 'fall':
      {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.setValueAtTime(700, t);
        o.frequency.exponentialRampToValueAtTime(160, t + 0.45);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.52);
      }
      break;
    case 'lose':
      [67, 64, 60, 55].forEach((m, i) => mallet(c, out, t + i * 0.16, m, 0.6, 0.12));
      break;
  }
}
