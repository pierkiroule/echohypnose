import { field } from "./field.js";

// ---------- utils ----------
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------- audio bus ----------
export const audioBus = {
  ctx: null,
  master: null,
  analyser: null,
  musicGain: null,
  voiceGain: null
};

// ---------- init ----------
export async function initAudio() {
  if (audioBus.ctx) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  audioBus.ctx = new AudioCtx();

  audioBus.master = audioBus.ctx.createGain();
  audioBus.master.gain.value = 0.9;

  audioBus.analyser = audioBus.ctx.createAnalyser();
  audioBus.analyser.fftSize = 1024;

  audioBus.musicGain = audioBus.ctx.createGain();
  audioBus.musicGain.gain.value = 0.5;

  audioBus.voiceGain = audioBus.ctx.createGain();
  audioBus.voiceGain.gain.value = 0.7;

  audioBus.musicGain.connect(audioBus.master);
  audioBus.voiceGain.connect(audioBus.master);
  audioBus.master.connect(audioBus.analyser);
  audioBus.analyser.connect(audioBus.ctx.destination);
}

export async function resumeAudioContext() {
  if (!audioBus.ctx) return;
  if (audioBus.ctx.state === "running") return;
  await audioBus.ctx.resume();
}

// ---------- loaders ----------
async function loadBuffer(url) {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await audioBus.ctx.decodeAudioData(arr);
  } catch (e) {
    console.error("Audio load error:", url, e);
    return null;
  }
}

// ---------- fx ----------
function createSoftFX(input) {
  const lp = audioBus.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;

  const delay = audioBus.ctx.createDelay(1.0);
  delay.delayTime.value = 0.12;

  const fb = audioBus.ctx.createGain();
  fb.gain.value = 0.15;

  input.connect(lp);
  lp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);

  return { out: delay, lp };
}

// ---------- state ----------
let running = false;

// ---------- MAIN ----------
export async function triggerResonanceOnce(config = {}) {
  if (!audioBus.ctx) await initAudio();
  if (audioBus.ctx.state !== "running") await audioBus.ctx.resume();

  if (running) return;
  running = true;

  const now = Date.now();

  // ---- config from sequence ----
  const musicPool = config.music?.length ? config.music : ["m01.mp3"];
  const voicePool = config.voice?.length ? config.voice : ["v01.mp3"];
  const mood = config.mood || field.params.mood || "calm";

  // ---- seed ----
  const seed = Math.floor(
    now +
    field.params.echoCount * 999 +
    field.params.intensity * 100000
  );
  const rng = mulberry32(seed);

  // ---------- MUSIC ----------
  const musicFile = pick(rng, musicPool);
  const musicBuf = await loadBuffer(`/audio/music/${musicFile}`);

  if (!musicBuf) {
    running = false;
    return;
  }

  const music = audioBus.ctx.createBufferSource();
  music.buffer = musicBuf;
  music.loop = true;

  const musicFX = createSoftFX(music);
  musicFX.out.connect(audioBus.musicGain);

  musicFX.lp.frequency.value =
    mood === "agitated" ? 900 :
    mood === "dense" ? 1200 :
    1600;

  audioBus.musicGain.gain.setValueAtTime(0.0001, audioBus.ctx.currentTime);
  audioBus.musicGain.gain.exponentialRampToValueAtTime(
    0.5,
    audioBus.ctx.currentTime + 2.5
  );

  music.start();

  // ---------- VOICES ----------
  const voiceCount =
    mood === "agitated" ? 6 :
    mood === "dense" ? 4 :
    3;

  let cursor = audioBus.ctx.currentTime + 2.0;

  for (let i = 0; i < voiceCount; i++) {
    const vf = pick(rng, voicePool);
    const vb = await loadBuffer(`/audio/voice/${vf}`);
    if (!vb) continue;

    const src = audioBus.ctx.createBufferSource();
    src.buffer = vb;

    const pan = audioBus.ctx.createStereoPanner();
    pan.pan.value = rng() * 1.2 - 0.6;

    const gain = audioBus.ctx.createGain();
    gain.gain.value = 0.0001;

    const fx = createSoftFX(src);
    fx.lp.frequency.value = mood === "agitated" ? 1000 : 1600;

    fx.out.connect(pan);
    pan.connect(gain);
    gain.connect(audioBus.voiceGain);

    const dur = vb.duration;
    const gap =
      mood === "agitated" ? 0.6 + rng() * 1.0 :
      mood === "dense" ? 1.2 + rng() * 1.6 :
      2.0 + rng() * 2.5;

    const t0 = cursor;
    const t1 = cursor + 0.25;
    const t2 = cursor + Math.min(1.8, dur);
    const t3 = t2 + 0.35;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.75, t1);
    gain.gain.setValueAtTime(0.75, t2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t3);

    src.start(t0);
    src.stop(t0 + dur);

    cursor += gap;
  }

  // ---------- STOP ----------
  const total = Math.max(
    45,
    Math.min(90, 40 + field.params.echoCount * 0.2 + field.params.intensity * 40)
  );

  const stopAt = audioBus.ctx.currentTime + total;

  audioBus.musicGain.gain.exponentialRampToValueAtTime(
    0.0001,
    stopAt - 2.0
  );
  audioBus.voiceGain.gain.exponentialRampToValueAtTime(
    0.0001,
    stopAt - 2.0
  );

  const totalMs = Math.floor(total * 1000);

  return {
    total,
    done: new Promise((resolve) => {
      setTimeout(() => {
        try { music.stop(); } catch {}
        running = false;
        resolve();
      }, totalMs);
    })
  };
}
