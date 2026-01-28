export function createAudioEngine() {
  let context = null;
  let masterGain = null;
  let analyser = null;
  let oscillators = [];
  let noiseSource = null;
  let started = false;

  function ensureContext() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = context.createGain();
      masterGain.gain.value = 0.0001;

      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      masterGain.connect(analyser);
      analyser.connect(context.destination);
    }
  }

  function createNoise() {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function startNodes() {
    if (started) return;
    started = true;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.8;

    const oscA = context.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = 220;

    const oscB = context.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = 330;

    const lfo = context.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 240;

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    oscA.connect(filter);
    oscB.connect(filter);

    const noise = createNoise();
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.04;
    noise.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(masterGain);

    oscillators = [oscA, oscB, lfo];
    noiseSource = noise;
    oscillators.forEach((osc) => osc.start());
    noiseSource.start();
  }

  function start() {
    ensureContext();
    if (context.state === "suspended") {
      context.resume();
    }
    startNodes();
    masterGain.gain.cancelScheduledValues(context.currentTime);
    masterGain.gain.setTargetAtTime(0.6, context.currentTime, 2.4);
  }

  function stop() {
    if (!context || !masterGain) return;
    masterGain.gain.cancelScheduledValues(context.currentTime);
    masterGain.gain.setTargetAtTime(0.0001, context.currentTime, 2.4);
  }

  function getLevel() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const sum = data.reduce((acc, value) => acc + value, 0);
    return Math.min(1, sum / (data.length * 255));
  }

  return {
    start,
    stop,
    getLevel
  };
}
