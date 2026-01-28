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
let selectedEmojis = new Set();
let selectedOrder = [];
let lastConstellation = { nodes: [], edges: [] };

const STAR_COUNT = 140;

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

function drawStars() {
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  stars.forEach((star) => {
    star.x += star.drift;
    if (star.x < -10) star.x = window.innerWidth + 10;
    if (star.x > window.innerWidth + 10) star.x = -10;

    ctx.globalAlpha = 0.3 + Math.sin(performance.now() * 0.001 + star.x) * 0.2;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawConstellation(constellation) {
  if (!constellation) return;

  constellation.edges.forEach((edge) => {
    const a = ensureNodePosition(edge.a);
    const b = ensureNodePosition(edge.b);
    const fade = 1 - sessionFade;
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
    const radius = baseSize * pulse;
    const fade = isSelected ? 1 : 1 - sessionFade;
    ctx.save();
    const halo = isSelected ? 0.8 : 0.35;
    ctx.shadowColor = `rgba(129,140,248,${(0.2 + node.normalized * 0.5 + halo * 0.3) * fade})`;
    ctx.shadowBlur = 10 + node.normalized * 18 + (isSelected ? 18 : 0);
    ctx.beginPath();
    ctx.fillStyle = `rgba(15,23,42,${0.45 * fade})`;
    ctx.strokeStyle = `rgba(148,163,184,${(0.5 + node.normalized * 0.4) * fade})`;
    ctx.lineWidth = 1.2 + node.normalized * 1.4;
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${16 + node.normalized * 8}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(226,232,240,${0.9 * fade})`;
    ctx.fillText(node.emoji, pos.x, pos.y);
    ctx.restore();
  });
}

function getSelectionTargets() {
  const spacing = Math.min(120, window.innerWidth * 0.2);
  const total = (selectedOrder.length - 1) * spacing;
  const startX = window.innerWidth / 2 - total / 2;
  const y = window.innerHeight - 110;
  return selectedOrder.reduce((acc, emoji, index) => {
    acc[emoji] = { x: startX + index * spacing, y };
    return acc;
  }, {});
}

function updateNodes() {
  const targets = sessionFade > 0.01 ? getSelectionTargets() : null;
  nodePositions.forEach((pos, emoji) => {
    if (targets && targets[emoji]) {
      const target = targets[emoji];
      pos.x += (target.x - pos.x) * 0.08;
      pos.y += (target.y - pos.y) * 0.08;
      pos.vx *= 0.95;
      pos.vy *= 0.95;
      return;
    }

    pos.x += pos.vx;
    pos.y += pos.vy;
    const padding = 40;
    if (pos.x < padding || pos.x > window.innerWidth - padding) pos.vx *= -1;
    if (pos.y < padding || pos.y > window.innerHeight * 0.7) pos.vy *= -1;
  });
}

function loop() {
  if (!running) return;
  if (window.devicePixelRatio !== lastDpr) resize();

  resonanceLevel += (resonanceTarget - resonanceLevel) * 0.05;
  sessionFade += (sessionTarget - sessionFade) * 0.05;

  ctx.fillStyle = `rgba(5,7,15,${0.16 - resonanceLevel * 0.04})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  updateNodes();
  lastConstellation = getConstellation ? getConstellation() : { nodes: [], edges: [] };
  drawConstellation(lastConstellation);

  requestAnimationFrame(loop);
}

function handlePointer(event) {
  if (!interactionEnabled) return;
  if (!lastConstellation?.nodes?.length) return;

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

  if (!hit) return;

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

export function initCosmos({
  getConstellation: getConstellationFn,
  onSelectionChange: onSelectionChangeFn,
  onSelectionComplete: onSelectionCompleteFn
}) {
  if (running) return;
  running = true;
  getConstellation = getConstellationFn;
  onSelectionChange = onSelectionChangeFn;
  onSelectionComplete = onSelectionCompleteFn;

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
