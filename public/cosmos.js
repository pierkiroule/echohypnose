let canvas;
let ctx;
let stars = [];
let nodePositions = new Map();
let running = false;
let lastDpr = window.devicePixelRatio || 1;
let resonanceLevel = 0;
let resonanceTarget = 0;
let sessionFade = 0;
let sessionTarget = 0;
let getConstellation = null;
let interactionEnabled = true;
let onSelectionChange = null;
let onSelectionComplete = null;
let onResonanceTap = null;
let onResonanceComplete = null;
let allowSelection = true;
let resonancePulse = 0;
let resonanceWaves = [];
let resonanceReady = false;
let lastTapTime = 0;
let selectedEmojis = new Set();
let selectedOrder = [];
let lastConstellation = { nodes: [], edges: [] };

const STAR_COUNT = 140;
const RESONANCE_TAP_COUNT = 3;
const RESONANCE_COLORS = ["rgba(129,140,248,", "rgba(248,205,129,", "rgba(125,211,252,"];

function createStar() {
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.2,
    drift: (Math.random() - 0.5) * 0.04
  };
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  lastDpr = dpr;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ensureNodePosition(emoji) {
  if (!nodePositions.has(emoji)) {
    nodePositions.set(emoji, {
      x: Math.random() * window.innerWidth,
      y: Math.random() * (window.innerHeight * 0.7),
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.015
    });
  }
  return nodePositions.get(emoji);
}

function drawStars(fade) {
  ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
  stars.forEach((star) => {
    star.x += star.drift;
    if (star.x < -10) star.x = window.innerWidth + 10;
    if (star.x > window.innerWidth + 10) star.x = -10;

    ctx.globalAlpha = (0.3 + Math.sin(performance.now() * 0.001 + star.x) * 0.2) * fade;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawConstellation(constellation, fade) {
  if (!constellation) return;

  constellation.edges.forEach((edge) => {
    const a = ensureNodePosition(edge.a);
    const b = ensureNodePosition(edge.b);
    const alpha = (0.12 + edge.normalized * 0.5) * fade;
    ctx.strokeStyle = `rgba(148,163,184,${alpha.toFixed(3)})`;
    ctx.lineWidth = 1 + edge.normalized * 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  constellation.nodes.forEach((node) => {
    const pos = ensureNodePosition(node.emoji);
    const isSelected = selectedEmojis.has(node.emoji);
    const baseSize = 18 + node.normalized * 22;
    const pulse = (isSelected ? 1.25 : 1) * (1 + node.normalized * 0.15);
    const radius = baseSize * pulse * (1 + resonancePulse * 0.12);
    const nodeFade = fade;
    ctx.save();
    const halo = isSelected ? 0.8 : 0.35;
    ctx.shadowColor = `rgba(129,140,248,${(0.2 + node.normalized * 0.5 + halo * 0.3) * nodeFade})`;
    ctx.shadowBlur = 10 + node.normalized * 18 + (isSelected ? 18 : 0);
    ctx.beginPath();
    ctx.fillStyle = `rgba(15,23,42,${0.45 * nodeFade})`;
    ctx.strokeStyle = `rgba(148,163,184,${(0.5 + node.normalized * 0.4) * nodeFade})`;
    ctx.lineWidth = 1.2 + node.normalized * 1.4;
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${16 + node.normalized * 8}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(226,232,240,${0.9 * nodeFade})`;
    ctx.fillText(node.emoji, pos.x, pos.y);
    ctx.restore();
  });
}

function updateNodes() {
  nodePositions.forEach((pos, emoji) => {
    pos.x += pos.vx;
    pos.y += pos.vy;
    const padding = 40;
    if (pos.x < padding || pos.x > window.innerWidth - padding) pos.vx *= -1;
    if (pos.y < padding || pos.y > window.innerHeight * 0.7) pos.vy *= -1;
  });
}

function drawResonanceWaves(now) {
  resonanceWaves = resonanceWaves.filter((wave) => now - wave.start < 5000);
  resonanceWaves.forEach((wave) => {
    wave.x += wave.vx;
    wave.y += wave.vy;
    if (wave.x < 40 || wave.x > window.innerWidth - 40) wave.vx *= -1;
    if (wave.y < 40 || wave.y > window.innerHeight - 40) wave.vy *= -1;

    const elapsed = now - wave.start;
    wave.radius = Math.min(Math.max(window.innerWidth, window.innerHeight) * 1.2, elapsed * 0.18);
    const alpha = Math.max(0, 0.6 - elapsed / 4500);
    ctx.strokeStyle = `${wave.color}${alpha})`;
    ctx.lineWidth = 1.5 + wave.index * 0.6;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function resolveResonanceChoice() {
  if (!resonanceWaves.length || !lastConstellation?.nodes?.length) return null;
  let bestEmoji = null;
  let bestScore = -Infinity;
  lastConstellation.nodes.forEach((node) => {
    const pos = ensureNodePosition(node.emoji);
    const score = resonanceWaves.reduce((sum, wave) => {
      const dist = Math.hypot(pos.x - wave.x, pos.y - wave.y);
      const ripple = Math.max(0, 1 - Math.abs(dist - wave.radius) / 140);
      return sum + ripple;
    }, 0);
    const weightedScore = score + node.normalized * 0.4;
    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestEmoji = node.emoji;
    }
  });
  return bestEmoji;
}

function loop() {
  if (!running) return;
  if (window.devicePixelRatio !== lastDpr) resize();

  const now = performance.now();
  resonanceLevel += (resonanceTarget - resonanceLevel) * 0.05;
  sessionFade += (sessionTarget - sessionFade) * 0.05;
  resonancePulse *= 0.92;
  const fade = Math.max(0, 1 - sessionFade);

  ctx.fillStyle = `rgba(5,7,15,${(0.16 - resonanceLevel * 0.04) * fade})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(fade);
  updateNodes();
  lastConstellation = getConstellation ? getConstellation() : { nodes: [], edges: [] };
  drawConstellation(lastConstellation, fade);
  drawResonanceWaves(now);

  if (resonanceReady && now - lastTapTime > 650) {
    const choice = resolveResonanceChoice();
    if (choice) {
      onResonanceComplete?.(choice);
    }
    resonanceReady = false;
    resonanceWaves = [];
  }

  requestAnimationFrame(loop);
}

function handlePointer(event) {
  if (!interactionEnabled) return;
  if (!lastConstellation?.nodes?.length) {
    onResonanceTap?.();
    resonancePulse = 1;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let hit = null;
  lastConstellation.nodes.forEach((node) => {
    const pos = ensureNodePosition(node.emoji);
    const dist = Math.hypot(x - pos.x, y - pos.y);
    const radius = 18 + node.normalized * 22;
    if (dist < radius) {
      hit = node.emoji;
    }
  });

  if (hit && allowSelection) {
    if (selectedEmojis.has(hit)) {
      selectedEmojis.delete(hit);
    } else if (selectedEmojis.size < 3) {
      selectedEmojis.add(hit);
    }

    const selection = [...selectedEmojis];
    onSelectionChange?.(selection);
    if (selection.length === 3) {
      onSelectionComplete?.(selection);
    }
  }

  if (!allowSelection) {
    if (resonanceWaves.length < RESONANCE_TAP_COUNT) {
      resonanceWaves.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.9,
        vy: (Math.random() - 0.5) * 0.9,
        radius: 0,
        start: performance.now(),
        index: resonanceWaves.length,
        color: RESONANCE_COLORS[resonanceWaves.length % RESONANCE_COLORS.length]
      });
      lastTapTime = performance.now();
      if (resonanceWaves.length === RESONANCE_TAP_COUNT) {
        resonanceReady = true;
      }
    }
  }

  onResonanceTap?.({ emoji: hit, x, y });
  resonancePulse = 1;
}

export function initCosmos({
  getConstellation: getConstellationFn,
  onSelectionChange: onSelectionChangeFn,
  onSelectionComplete: onSelectionCompleteFn,
  onResonanceTap: onResonanceTapFn,
  onResonanceComplete: onResonanceCompleteFn,
  allowSelection: allowSelectionValue = true
}) {
  if (running) return;
  running = true;
  getConstellation = getConstellationFn;
  onSelectionChange = onSelectionChangeFn;
  onSelectionComplete = onSelectionCompleteFn;
  onResonanceTap = onResonanceTapFn;
  onResonanceComplete = onResonanceCompleteFn;
  allowSelection = allowSelectionValue;

  canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "auto";
  document.body.appendChild(canvas);

  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", handlePointer);

  stars = Array.from({ length: STAR_COUNT }, createStar);
  requestAnimationFrame(loop);
}

export function setResonance(active) {
  resonanceTarget = active ? 1 : 0;
}

export function setSessionState({ active, selection = [] } = {}) {
  sessionTarget = active ? 1 : 0;
  selectedOrder = active ? [...selection] : [];
}

export function setInteractionEnabled(enabled) {
  interactionEnabled = enabled;
}

export function clearSelection() {
  selectedEmojis = new Set();
  selectedOrder = [];
  onSelectionChange?.([]);
}
