let canvas;
let ctx;
let stars = [];
let drops = [];
let nodePositions = new Map();
let running = false;
let lastDpr = window.devicePixelRatio || 1;
let resonanceLevel = 0;
let resonanceTarget = 0;
let getConstellation = null;

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
      vx: (Math.random() - 0.5) * 0.05,
      vy: (Math.random() - 0.5) * 0.05
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
    const alpha = 0.15 + edge.normalized * 0.4 + resonanceLevel * 0.2;
    ctx.strokeStyle = `rgba(148,163,184,${alpha.toFixed(3)})`;
    ctx.lineWidth = 1 + edge.normalized * 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  constellation.nodes.forEach((node) => {
    const pos = ensureNodePosition(node.emoji);
    const pulse = 1 + node.normalized * 0.8 + resonanceLevel * 0.6;
    ctx.save();
    ctx.shadowColor = `rgba(129,140,248,${0.4 + node.normalized * 0.4})`;
    ctx.shadowBlur = 12 + node.normalized * 18;
    ctx.font = `${26 * pulse}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.emoji, pos.x, pos.y);
    ctx.restore();
  });
}

function drawDrops() {
  drops.forEach((drop) => {
    drop.x += drop.vx;
    drop.y += drop.vy;
    drop.vx *= 0.99;
    drop.vy *= 0.99;

    const wobble = Math.sin(performance.now() * 0.003 + drop.seed) * (0.4 + resonanceLevel);
    ctx.save();
    ctx.font = `${28 + resonanceLevel * 8}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = `rgba(248,250,252,${0.3 + resonanceLevel * 0.3})`;
    ctx.shadowBlur = 18;
    ctx.fillText(drop.emoji, drop.x + wobble, drop.y - wobble);
    ctx.restore();
  });
}

function updateNodes() {
  nodePositions.forEach((pos) => {
    pos.x += pos.vx * (1 + resonanceLevel * 1.5);
    pos.y += pos.vy * (1 + resonanceLevel * 1.5);
    const padding = 40;
    if (pos.x < padding || pos.x > window.innerWidth - padding) pos.vx *= -1;
    if (pos.y < padding || pos.y > window.innerHeight * 0.7) pos.vy *= -1;
  });
}

function loop() {
  if (!running) return;
  if (window.devicePixelRatio !== lastDpr) resize();

  resonanceLevel += (resonanceTarget - resonanceLevel) * 0.05;

  ctx.fillStyle = `rgba(5,7,15,${0.16 - resonanceLevel * 0.04})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  updateNodes();
  drawConstellation(getConstellation ? getConstellation() : null);
  drawDrops();

  requestAnimationFrame(loop);
}

export function initCosmos({ getConstellation: getConstellationFn }) {
  if (running) return;
  running = true;
  getConstellation = getConstellationFn;

  canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);

  stars = Array.from({ length: STAR_COUNT }, createStar);
  requestAnimationFrame(loop);
}

export function addDrop(emoji, x, y) {
  drops.push({
    emoji,
    x,
    y,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    seed: Math.random() * 10
  });
}

export function clearDrops() {
  drops = [];
}

export function setResonance(active) {
  resonanceTarget = active ? 1 : 0;
}
