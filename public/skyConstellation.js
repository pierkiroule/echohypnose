// Ciel boréal · Bulles émojis flottantes
// Canvas BACKGROUND — stable mobile

let canvas, ctx;
let bubbles = [];
let selected = [];
let onToggle = null;
let running = false;
let interactionEnabled = true;
let pulseLevel = 0;
let breatheState = null;
let selectionFade = 1;
let dissolving = false;
let lastDpr = window.devicePixelRatio || 1;

export function initSky({ emojis = [], onToggle: cb }) {
  if (running) return;
  running = true;

  onToggle = cb;

  canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "0";
  document.body.appendChild(canvas);

  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);

  bubbles = emojis.map(makeBubble);
  canvas.addEventListener("pointerdown", onPointer);

  requestAnimationFrame(loop);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  lastDpr = dpr;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeBubble(emoji) {
  return {
    emoji,
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.15,
    r: 26,
    selected: false
  };
}

function onPointer(e) {
  if (!interactionEnabled) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  bubbles.forEach(b => {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < b.r) {
      if (!b.selected && selected.length >= 3) return;

      b.selected = !b.selected;

      if (b.selected) selected.push(b);
      else selected = selected.filter(s => s !== b);

      if (onToggle) onToggle(selected.map(s => s.emoji));
    }
  });
}

function drawLinks() {
  if (selected.length < 2) return;

  const alpha = (0.25 + pulseLevel * 0.35) * selectionFade;
  ctx.strokeStyle = `rgba(147,197,253,${alpha.toFixed(3)})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(selected[0].x, selected[0].y);
  selected.slice(1).forEach(b => ctx.lineTo(b.x, b.y));
  ctx.stroke();
}

function loop() {
  if (window.devicePixelRatio !== lastDpr) resize();

  const baseFade = 0.12;
  let breatheFade = 0;
  if (breatheState) {
    const now = performance.now();
    const t = Math.min(1, (now - breatheState.start) / breatheState.duration);
    const phase = Math.sin(Math.PI * 2 * breatheState.cycles * t);
    breatheFade = (0.5 - 0.5 * Math.cos(Math.PI * 2 * breatheState.cycles * t)) * 0.14;
    if (t >= 1) {
      breatheState.resolve();
      breatheState = null;
    }
    breatheFade += Math.abs(phase) * 0.02;
  }

  ctx.fillStyle = `rgba(2,6,23,${(baseFade + breatheFade).toFixed(3)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawLinks();

  bubbles.forEach(b => {
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < -50) b.x = window.innerWidth + 50;
    if (b.x > window.innerWidth + 50) b.x = -50;
    if (b.y < -50) b.y = window.innerHeight + 50;
    if (b.y > window.innerHeight + 50) b.y = -50;

    ctx.save();
    ctx.font = "38px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const glowBoost = b.selected ? (0.6 + pulseLevel * 0.6) * selectionFade : 0.2;
    const shadowAlpha = b.selected ? 0.45 + pulseLevel * 0.35 : 0.2;

    ctx.shadowColor = b.selected
      ? `rgba(147,197,253,${shadowAlpha.toFixed(3)})`
      : "rgba(255,255,255,0.25)";
    ctx.shadowBlur = b.selected ? 18 + glowBoost * 18 : 10;

    ctx.fillText(b.emoji, b.x, b.y);
    ctx.restore();
  });

  requestAnimationFrame(loop);
}

export function setPulseLevel(level) {
  pulseLevel = Math.max(0, Math.min(1, level));
}

export function setInteractionEnabled(enabled) {
  interactionEnabled = enabled;
}

export function startBreathing({ cycles = 2, duration = 9000 } = {}) {
  return new Promise((resolve) => {
    breatheState = {
      cycles,
      duration,
      start: performance.now(),
      resolve
    };
  });
}

export function dissolveSelection(duration = 4000) {
  if (dissolving) return Promise.resolve();
  dissolving = true;
  selectionFade = 1;
  const start = performance.now();

  return new Promise((resolve) => {
    function step() {
      const t = Math.min(1, (performance.now() - start) / duration);
      selectionFade = 1 - t;
      if (t >= 1) {
        selected.forEach(b => {
          b.selected = false;
        });
        selected = [];
        selectionFade = 1;
        dissolving = false;
        if (onToggle) onToggle([]);
        resolve();
        return;
      }
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  });
}
