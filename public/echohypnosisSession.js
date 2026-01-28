import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const EMOJI_PROFILES = {
  "🌊": { tempo: 0.35, density: 0.5, drift: 0.8, warmth: 0.3, dispersion: 0.6, orbit: 0.5 },
  "🕯️": { tempo: 0.4, density: 0.35, drift: 0.4, warmth: 0.95, dispersion: 0.2, orbit: 0.25 },
  "🌫️": { tempo: 0.3, density: 0.6, drift: 0.7, warmth: 0.45, dispersion: 0.85, orbit: 0.35 },
  "🪵": { tempo: 0.25, density: 0.45, drift: 0.2, warmth: 0.35, dispersion: 0.2, orbit: 0.15 },
  "🪐": { tempo: 0.55, density: 0.55, drift: 0.5, warmth: 0.5, dispersion: 0.4, orbit: 0.9 },
  "🎐": { tempo: 0.6, density: 0.4, drift: 0.9, warmth: 0.55, dispersion: 0.7, orbit: 0.65 }
};

const MUSIC_POOL = ["m01.mp3", "m02.mp3", "m03.mp3"];
const VOICE_POOL = ["v01.mp3", "v02.mp3", "v03.mp3"];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function average(values) {
  return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function buildProfile(emojis, rng) {
  const profiles = emojis.map((emoji) => EMOJI_PROFILES[emoji]).filter(Boolean);
  const tempo = clamp01(average(profiles.map((p) => p.tempo)) + (rng() - 0.5) * 0.2);
  const density = clamp01(average(profiles.map((p) => p.density)) + (rng() - 0.5) * 0.2);
  const drift = clamp01(average(profiles.map((p) => p.drift)) + (rng() - 0.5) * 0.2);
  const warmth = clamp01(average(profiles.map((p) => p.warmth)) + (rng() - 0.5) * 0.15);
  const dispersion = clamp01(average(profiles.map((p) => p.dispersion)) + (rng() - 0.5) * 0.2);
  const orbit = clamp01(average(profiles.map((p) => p.orbit)) + (rng() - 0.5) * 0.2);

  return {
    tempo,
    density,
    drift,
    warmth,
    dispersion,
    orbit
  };
}

let sharedContext = null;

function getAudioContext() {
  if (!sharedContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedContext = new AudioCtx();
  }
  return sharedContext;
}

async function loadBuffer(ctx, url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

function createBandAnalyser(ctx) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  return analyser;
}

function computeBands(data) {
  const bands = { bass: 0, mid: 0, high: 0 };
  const bassEnd = Math.floor(data.length * 0.12);
  const midEnd = Math.floor(data.length * 0.45);
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i] / 255;
    if (i <= bassEnd) bands.bass += v;
    else if (i <= midEnd) bands.mid += v;
    else bands.high += v;
  }
  bands.bass /= Math.max(1, bassEnd);
  bands.mid /= Math.max(1, midEnd - bassEnd);
  bands.high /= Math.max(1, data.length - midEnd);
  return bands;
}

export async function startEchohypnosisSession(
  emojis,
  { cycleDuration = 60000, onStop = null } = {}
) {
  const seed = Date.now() + Math.floor(Math.random() * 10000);
  const rng = mulberry32(seed);
  const profile = buildProfile(emojis, rng);

  const ctx = getAudioContext();
  if (ctx.state !== "running") {
    await ctx.resume();
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.0001;
  masterGain.connect(ctx.destination);

  const musicGain = ctx.createGain();
  const voiceGain = ctx.createGain();
  musicGain.gain.value = 0.6;
  voiceGain.gain.value = 0.8;

  const musicAnalyser = createBandAnalyser(ctx);
  const voiceAnalyser = createBandAnalyser(ctx);

  musicGain.connect(musicAnalyser);
  musicAnalyser.connect(masterGain);

  voiceGain.connect(voiceAnalyser);
  voiceAnalyser.connect(masterGain);

  const musicBuffer = await loadBuffer(ctx, `/audio/music/${pick(rng, MUSIC_POOL)}`);
  const musicSource = ctx.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.loop = true;
  musicSource.connect(musicGain);

  const voiceBuffers = await Promise.all(
    VOICE_POOL.map((file) => loadBuffer(ctx, `/audio/voice/${file}`))
  );

  const voiceSources = [];
  const voiceTimers = new Set();
  const voiceSpacing = 1.8 - profile.tempo * 0.8;

  const now = ctx.currentTime;
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.85, now + 2.5);

  musicSource.start(now + 0.05);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = "fixed";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "1";
  renderer.domElement.style.pointerEvents = "auto";
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070f, 5, 18);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0.6, 6.5);

  const ambient = new THREE.AmbientLight(0x8a9df8, 0.35 + profile.warmth * 0.2);
  scene.add(ambient);

  const coreLight = new THREE.PointLight(0xffd6a3, 0.6 + profile.warmth * 0.8, 18);
  coreLight.position.set(0, 1.2, 2.5);
  scene.add(coreLight);

  const cluster = new THREE.Group();
  scene.add(cluster);

  const constellation = new THREE.Group();
  scene.add(constellation);

  const baseColor = new THREE.Color().setHSL(0.6 - profile.warmth * 0.3, 0.55, 0.6);
  const glowColor = new THREE.Color().setHSL(0.08 + profile.warmth * 0.15, 0.7, 0.65);

  const organicCount = Math.floor(18 + profile.density * 30);
  const organicMeshes = [];
  for (let i = 0; i < organicCount; i += 1) {
    const geometry = new THREE.IcosahedronGeometry(0.22 + rng() * 0.35, 0);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor.clone().offsetHSL(rng() * 0.08, 0, 0.1),
      roughness: 0.45,
      metalness: 0.1,
      transparent: true,
      opacity: 0.65
    });
    const mesh = new THREE.Mesh(geometry, material);
    const radius = 1.2 + rng() * 2.8 + profile.dispersion * 1.6;
    const angle = rng() * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * radius, (rng() - 0.5) * 1.8, Math.sin(angle) * radius);
    mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    mesh.userData = {
      spin: new THREE.Vector3((rng() - 0.5) * 0.003, (rng() - 0.5) * 0.004, (rng() - 0.5) * 0.003),
      drift: new THREE.Vector3((rng() - 0.5) * 0.002, (rng() - 0.5) * 0.0015, (rng() - 0.5) * 0.002),
      baseScale: 0.85 + rng() * 0.6
    };
    cluster.add(mesh);
    organicMeshes.push(mesh);
  }

  const points = [];
  const radius = 1.4 + profile.orbit * 1.2;
  emojis.slice(0, 3).forEach((emoji, index) => {
    const angle = (index / 3) * Math.PI * 2 + profile.orbit * 0.6;
    const x = Math.cos(angle) * radius;
    const y = 0.4 - index * 0.35;
    const z = Math.sin(angle) * radius;
    points.push(new THREE.Vector3(x, y, z));

    const nodeGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: glowColor.clone().offsetHSL(index * 0.05, 0, 0.08),
      emissive: glowColor,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.9
    });
    const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
    node.position.set(x, y, z);
    node.userData = { baseScale: 1.0, emoji };
    constellation.add(node);
  });

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x9aa9ff, transparent: true, opacity: 0.4 });
  const line = new THREE.LineLoop(lineGeometry, lineMaterial);
  constellation.add(line);

  const controlsGroup = new THREE.Group();
  controlsGroup.position.set(0, -1.9, 2.6);
  scene.add(controlsGroup);

  const controlColor = new THREE.Color(0x9aa9ff);
  const controlMaterial = new THREE.MeshStandardMaterial({
    color: controlColor,
    emissive: controlColor,
    emissiveIntensity: 0.4,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7
  });

  const playShape = new THREE.Shape();
  playShape.moveTo(-0.18, -0.22);
  playShape.lineTo(0.22, 0);
  playShape.lineTo(-0.18, 0.22);
  playShape.lineTo(-0.18, -0.22);
  const playMesh = new THREE.Mesh(new THREE.ShapeGeometry(playShape), controlMaterial.clone());
  playMesh.userData.control = "play";
  playMesh.position.set(-0.7, 0, 0);
  controlsGroup.add(playMesh);

  const pauseGroup = new THREE.Group();
  pauseGroup.userData.control = "pause";
  const barGeom = new THREE.BoxGeometry(0.12, 0.32, 0.08);
  const leftBar = new THREE.Mesh(barGeom, controlMaterial.clone());
  const rightBar = new THREE.Mesh(barGeom, controlMaterial.clone());
  leftBar.position.set(-0.08, 0, 0);
  rightBar.position.set(0.08, 0, 0);
  pauseGroup.add(leftBar, rightBar);
  controlsGroup.add(pauseGroup);

  const stopMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), controlMaterial.clone());
  stopMesh.userData.control = "stop";
  stopMesh.position.set(0.7, 0, 0);
  controlsGroup.add(stopMesh);

  const controlTargets = [playMesh, pauseGroup, stopMesh];

  const musicData = new Uint8Array(musicAnalyser.frequencyBinCount);
  const voiceData = new Uint8Array(voiceAnalyser.frequencyBinCount);

  let active = true;
  let playing = true;
  const start = performance.now();

  function resize() {
    const { innerWidth, innerHeight } = window;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function setControlsState(nextPlaying) {
    playing = nextPlaying;
    const targetGain = nextPlaying ? 0.85 : 0.0001;
    masterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.25);

    playMesh.material.opacity = nextPlaying ? 0.35 : 0.85;
    pauseGroup.children.forEach((mesh) => {
      mesh.material.opacity = nextPlaying ? 0.85 : 0.35;
    });
  }

  function handlePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(controlTargets, true);
    if (!hits.length) return;
    const hit = hits[0].object;
    const control = hit.userData.control || hit.parent?.userData.control;
    if (control === "play") {
      setControlsState(true);
    }
    if (control === "pause") {
      setControlsState(false);
    }
    if (control === "stop") {
      stop();
    }
  }

  renderer.domElement.addEventListener("pointerdown", handlePointer);
  setControlsState(true);

  function scheduleVoice() {
    if (!active) return;
    const buffer = pick(rng, voiceBuffers);
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const panner = ctx.createStereoPanner();
    panner.pan.value = (rng() * 2 - 1) * (0.2 + profile.dispersion * 0.7);

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(voiceGain);

    const startAt = ctx.currentTime + 0.05;
    const fadeIn = startAt + 0.25;
    const fadeOut = startAt + Math.min(buffer.duration, 2.8);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.75, fadeIn);
    gain.gain.exponentialRampToValueAtTime(0.0001, fadeOut);

    source.start(startAt);
    source.stop(fadeOut + 0.1);
    voiceSources.push(source);

    const gapMs = (voiceSpacing + rng() * 1.6 + profile.density * 0.6) * 1000;
    const timer = window.setTimeout(() => {
      voiceTimers.delete(timer);
      scheduleVoice();
    }, gapMs);
    voiceTimers.add(timer);
  }

  scheduleVoice();

  function animate() {
    if (!active) return;

    const elapsed = performance.now() - start;
    const cycleT = (elapsed % cycleDuration) / cycleDuration;
    const entryPhase = clamp01(cycleT / 0.25);
    const exitPhase = clamp01((cycleT - 0.75) / 0.25);
    const corePhase = clamp01((cycleT - 0.25) / 0.5);

    musicAnalyser.getByteFrequencyData(musicData);
    voiceAnalyser.getByteFrequencyData(voiceData);
    const musicBands = computeBands(musicData);
    const voiceBands = computeBands(voiceData);

    const bass = (musicBands.bass + voiceBands.bass) * 0.5;
    const mid = (musicBands.mid + voiceBands.mid) * 0.5;
    const high = (musicBands.high + voiceBands.high) * 0.5;

    cluster.rotation.y += 0.002 + profile.orbit * 0.002 + bass * 0.004;
    cluster.rotation.x += 0.0008 + mid * 0.002;

    organicMeshes.forEach((mesh) => {
      mesh.rotation.x += mesh.userData.spin.x * (1 + mid);
      mesh.rotation.y += mesh.userData.spin.y * (1 + high);
      mesh.rotation.z += mesh.userData.spin.z * (1 + mid);

      mesh.position.addScaledVector(mesh.userData.drift, 1 + profile.drift);
      const scale = mesh.userData.baseScale + bass * 0.5 + high * 0.2;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = 0.15 + entryPhase * 0.55 + corePhase * 0.3 - exitPhase * 0.4;
    });

    constellation.children.forEach((node) => {
      if (!node.material) return;
      const pulse = 1 + mid * 0.7 + high * 0.5;
      node.scale.setScalar(node.userData?.baseScale ? node.userData.baseScale * pulse : pulse);
      node.material.opacity = 0.2 + entryPhase * 0.7 - exitPhase * 0.4;
    });

    coreLight.intensity = 0.4 + entryPhase * 0.5 + mid * 0.6 - exitPhase * 0.5;
    ambient.intensity = 0.25 + entryPhase * 0.25 + high * 0.2 - exitPhase * 0.2;

    controlsGroup.rotation.z = Math.sin(elapsed * 0.0008) * 0.15;
    controlsGroup.position.y = -1.9 + Math.sin(elapsed * 0.0006) * 0.08;
    controlsGroup.children.forEach((control) => {
      control.scale.setScalar(1 + bass * 0.12 + mid * 0.06);
    });

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
  }

  animate();

  function stop() {
    if (!active) return;
    active = false;
    window.removeEventListener("resize", resize);
    renderer.domElement.removeEventListener("pointerdown", handlePointer);
    renderer.dispose();
    renderer.domElement.remove();
    scene.clear();
    try { musicSource.stop(); } catch {}
    voiceSources.forEach((src) => {
      try { src.stop(); } catch {}
    });
    voiceTimers.forEach((timer) => window.clearTimeout(timer));
    voiceTimers.clear();
    masterGain.disconnect();
    musicGain.disconnect();
    voiceGain.disconnect();
    musicAnalyser.disconnect();
    voiceAnalyser.disconnect();
    onStop?.();
  }

  return {
    stop,
    pause: () => setControlsState(false),
    resume: () => setControlsState(true)
  };
}

window.startEchohypnosisSession = startEchohypnosisSession;
