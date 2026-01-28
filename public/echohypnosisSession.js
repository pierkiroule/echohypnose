import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { VRButton } from "https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js";

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

function createEmojiTexture(emoji, tint) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  const base = tint.clone().offsetHSL(0, 0, 0.1).getStyle();
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.5, base);
  gradient.addColorStop(1, "rgba(5,7,15,0.1)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "140px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  ctx.fillText(emoji, size / 2, size / 2 + 6);
  return new THREE.CanvasTexture(canvas);
}

function createStarfield(rng, count = 400) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const radius = 14;
  for (let i = 0; i < count; i += 1) {
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = radius - rng() * 2;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x9aa9ff, size: 0.06, transparent: true, opacity: 0.35 });
  return new THREE.Points(geometry, material);
}

function createPointCloud(rng, count = 900) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(0x7f8cff);
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const radius = 3 + rng() * 5.5;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    positions[idx] = radius * Math.sin(phi) * Math.cos(theta);
    positions[idx + 1] = (rng() - 0.5) * 3.5;
    positions[idx + 2] = radius * Math.sin(phi) * Math.sin(theta);
    velocities[idx] = (rng() - 0.5) * 0.0025;
    velocities[idx + 1] = (rng() - 0.5) * 0.0015;
    velocities[idx + 2] = (rng() - 0.5) * 0.0025;
    const tint = baseColor.clone().offsetHSL(rng() * 0.1, 0, rng() * 0.15);
    colors[idx] = tint.r;
    colors[idx + 1] = tint.g;
    colors[idx + 2] = tint.b;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.userData = { velocities, baseOpacity: 0.6 };
  return points;
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
  renderer.xr.enabled = true;

  const vrButton = VRButton.createButton(renderer);
  vrButton.classList.add("vr-toggle");
  vrButton.textContent = "VR";
  document.body.appendChild(vrButton);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070f, 6, 22);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0, 0.1);

  const ambient = new THREE.AmbientLight(0x8a9df8, 0.45 + profile.warmth * 0.2);
  scene.add(ambient);

  const coreLight = new THREE.PointLight(0xffd6a3, 0.8 + profile.warmth * 0.8, 18);
  coreLight.position.set(0.6, 0.4, 1.6);
  scene.add(coreLight);

  const starfield = createStarfield(rng);
  scene.add(starfield);

  const pointCloud = createPointCloud(rng);
  scene.add(pointCloud);

  const cluster = new THREE.Group();
  scene.add(cluster);

  const emojiGroup = new THREE.Group();
  scene.add(emojiGroup);

  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

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
    const radius = 1.6 + rng() * 3.4 + profile.dispersion * 2.2;
    const angle = rng() * Math.PI * 2;
    mesh.position.set(Math.cos(angle) * radius, (rng() - 0.5) * 2.4, Math.sin(angle) * radius);
    mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    mesh.userData = {
      spin: new THREE.Vector3((rng() - 0.5) * 0.003, (rng() - 0.5) * 0.004, (rng() - 0.5) * 0.003),
      drift: new THREE.Vector3((rng() - 0.5) * 0.002, (rng() - 0.5) * 0.0015, (rng() - 0.5) * 0.002),
      baseScale: 0.85 + rng() * 0.6
    };
    cluster.add(mesh);
    organicMeshes.push(mesh);
  }

  const activeEmojis = emojis.length ? emojis.slice(0, 3) : ["✨"];
  activeEmojis.forEach((emoji, index) => {
    const tint = glowColor.clone().offsetHSL(index * 0.08, 0, 0.1);
    const texture = createEmojiTexture(emoji, tint);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.scale.set(0.9, 0.9, 1);

    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 32, 32),
      new THREE.MeshStandardMaterial({
        color: tint,
        emissive: tint,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.25,
        roughness: 0.1,
        metalness: 0.2
      })
    );

    const node = new THREE.Group();
    node.add(bubble);
    node.add(sprite);
    node.userData = {
      emoji,
      orbitRadius: activeEmojis.length === 1 ? 0 : 1.8 + rng() * 1.4,
      orbitOffset: rng() * Math.PI * 2,
      orbitSpeed: activeEmojis.length === 1 ? 0 : 0.15 + rng() * 0.2,
      floatOffset: rng() * Math.PI * 2,
      baseY: activeEmojis.length === 1 ? 0 : (rng() - 0.5) * 0.8,
      baseScale: 0.85 + rng() * 0.25
    };
    emojiGroup.add(node);
  });

  const ringCount = 3;
  for (let i = 0; i < ringCount; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6 + i * 0.65, 0.04, 12, 90),
      new THREE.MeshBasicMaterial({
        color: glowColor.clone().offsetHSL(i * 0.04, 0, 0.1),
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      })
    );
    ring.rotation.set(Math.PI / 2, rng() * Math.PI, rng() * Math.PI);
    ring.userData = { spin: 0.0006 + rng() * 0.0008, pulse: 1 + rng() * 0.2 };
    ringGroup.add(ring);
  }

  const musicData = new Uint8Array(musicAnalyser.frequencyBinCount);
  const voiceData = new Uint8Array(voiceAnalyser.frequencyBinCount);

  let active = true;
  const start = performance.now();

  function resize() {
    const { innerWidth, innerHeight } = window;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);

  function setAudioState(nextPlaying) {
    const targetGain = nextPlaying ? 0.85 : 0.0001;
    masterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.25);
  }

  function handleExitKey(event) {
    if (event.key === "Escape") {
      stop();
    }
  }

  window.addEventListener("keydown", handleExitKey);
  renderer.domElement.addEventListener("dblclick", stop);
  setAudioState(true);

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

  const endTime = ctx.currentTime + cycleDuration / 1000;
  masterGain.gain.setTargetAtTime(0.0001, endTime - 2.2, 0.8);
  const autoStopTimer = window.setTimeout(() => stop(), cycleDuration + 200);

  function animate() {
    if (!active) return;

    const elapsed = performance.now() - start;
    const time = elapsed * 0.001;

    musicAnalyser.getByteFrequencyData(musicData);
    voiceAnalyser.getByteFrequencyData(voiceData);
    const musicBands = computeBands(musicData);
    const voiceBands = computeBands(voiceData);

    const bass = (musicBands.bass + voiceBands.bass) * 0.5;
    const mid = (musicBands.mid + voiceBands.mid) * 0.5;
    const high = (musicBands.high + voiceBands.high) * 0.5;

    const pointPositions = pointCloud.geometry.attributes.position.array;
    const pointVelocities = pointCloud.userData.velocities;
    for (let i = 0; i < pointPositions.length; i += 3) {
      pointPositions[i] += pointVelocities[i] * (1 + bass * 1.2);
      pointPositions[i + 1] += pointVelocities[i + 1] * (1 + mid);
      pointPositions[i + 2] += pointVelocities[i + 2] * (1 + high);
      if (pointPositions[i] > 7 || pointPositions[i] < -7) pointVelocities[i] *= -1;
      if (pointPositions[i + 1] > 3.5 || pointPositions[i + 1] < -3.5) pointVelocities[i + 1] *= -1;
      if (pointPositions[i + 2] > 7 || pointPositions[i + 2] < -7) pointVelocities[i + 2] *= -1;
    }
    pointCloud.geometry.attributes.position.needsUpdate = true;
    pointCloud.material.opacity = pointCloud.userData.baseOpacity + bass * 0.25 + high * 0.1;
    pointCloud.rotation.y += 0.0006 + mid * 0.0008;

    cluster.rotation.y += 0.0014 + profile.orbit * 0.0015 + bass * 0.003;
    cluster.rotation.x += 0.0006 + mid * 0.0015;

    organicMeshes.forEach((mesh) => {
      mesh.rotation.x += mesh.userData.spin.x * (1 + mid);
      mesh.rotation.y += mesh.userData.spin.y * (1 + high);
      mesh.rotation.z += mesh.userData.spin.z * (1 + mid);

      mesh.position.addScaledVector(mesh.userData.drift, 1 + profile.drift);
      const scale = mesh.userData.baseScale + bass * 0.5 + high * 0.2;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = 0.2 + bass * 0.4 + high * 0.2;
    });

    emojiGroup.children.forEach((node) => {
      const { orbitRadius, orbitOffset, orbitSpeed, floatOffset, baseY, baseScale } = node.userData;
      const angle = time * orbitSpeed + orbitOffset;
      const bob = Math.sin(time * 0.9 + floatOffset) * (orbitRadius === 0 ? 0.18 : 0.35);
      node.position.set(Math.cos(angle) * orbitRadius, baseY + bob, Math.sin(angle) * orbitRadius);
      const pulse = 1 + bass * 0.7 + mid * 0.35;
      node.scale.setScalar(baseScale * pulse);
      node.children.forEach((child) => {
        if (child.material) {
          child.material.opacity = 0.2 + bass * 0.4 + high * 0.2;
        }
      });
    });

    ringGroup.children.forEach((ring, index) => {
      ring.rotation.z += ring.userData.spin + index * 0.0002;
      const pulse = 1 + bass * 0.6 + mid * 0.3;
      ring.scale.setScalar(ring.userData.pulse * pulse);
      ring.material.opacity = 0.15 + bass * 0.35 + high * 0.15;
    });

    starfield.rotation.y += 0.0003 + high * 0.0006;

    coreLight.intensity = 0.6 + bass * 0.6 + mid * 0.4;
    ambient.intensity = 0.35 + high * 0.4;

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);

  function stop() {
    if (!active) return;
    active = false;
    window.clearTimeout(autoStopTimer);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", handleExitKey);
    renderer.domElement.removeEventListener("dblclick", stop);
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer.domElement.remove();
    vrButton.remove();
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
    pause: () => setAudioState(false),
    resume: () => setAudioState(true)
  };
}

window.startEchohypnosisSession = startEchohypnosisSession;
