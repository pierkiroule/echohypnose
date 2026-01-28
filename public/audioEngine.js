let audioContext = null;
let activeNodes = [];

export function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
  }
  return audioContext;
}

export async function resumeAudio() {
  const ctx = ensureAudioContext();
  if (ctx.state !== "running") {
    await ctx.resume();
  }
  return ctx;
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }
  return buffer;
}

export function startAudioScene({ duration = 60000, intensity = 0.5 } = {}) {
  const ctx = ensureAudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx);
  noise.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 600 + intensity * 900;

  const pad = ctx.createOscillator();
  pad.type = "sine";
  pad.frequency.value = 110 + intensity * 80;

  const padGain = ctx.createGain();
  padGain.gain.value = 0.15 + intensity * 0.2;

  const shimmer = ctx.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.value = 220 + intensity * 110;

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.05 + intensity * 0.1;

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08 + intensity * 0.04;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;

  lfo.connect(lfoGain);
  lfoGain.connect(shimmer.frequency);

  noise.connect(noiseFilter);
  noiseFilter.connect(master);

  pad.connect(padGain);
  padGain.connect(master);

  shimmer.connect(shimmerGain);
  shimmerGain.connect(master);

  const now = ctx.currentTime;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.55, now + 2.5);

  noise.start();
  pad.start();
  shimmer.start();
  lfo.start();

  const stopAt = now + duration / 1000;
  master.gain.exponentialRampToValueAtTime(0.0001, stopAt - 2);

  activeNodes.push(master, noise, pad, shimmer, lfo);

  const stop = () => {
    try { noise.stop(); } catch {}
    try { pad.stop(); } catch {}
    try { shimmer.stop(); } catch {}
    try { lfo.stop(); } catch {}
    noise.disconnect();
    pad.disconnect();
    shimmer.disconnect();
    lfo.disconnect();
    noiseFilter.disconnect();
    padGain.disconnect();
    shimmerGain.disconnect();
    master.disconnect();
    activeNodes = activeNodes.filter((node) => ![master, noise, pad, shimmer, lfo].includes(node));
  };

  return { stop };
}
