// Visuel réactif — canvas FOREGROUND

let canvas, ctx;
let particles = [];
let config = null;
let running = false;
let fading = false;
let fadeLevel = 0;
let lastDpr = window.devicePixelRatio || 1;
let loopActive = false;

export function initVisual() {
  if (running) return;
  running = true;

  canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "1";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
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

export function triggerVisual(cfg) {
  config = cfg;
  particles = [];
  fadeLevel = 1;
  fading = false;

  const count = Math.floor(60 * cfg.spread);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * cfg.motion * 2,
      vy: (Math.random() - 0.5) * cfg.motion * 2,
      r: 1 + Math.random() * 2
    });
  }

  if (!loopActive) {
    loopActive = true;
    requestAnimationFrame(loop);
  }
}

function loop() {
  if (!config && fadeLevel <= 0) {
    loopActive = false;
    return;
  }
  if (window.devicePixelRatio !== lastDpr) resize();

  const fade = Math.max(0, Math.min(1, fadeLevel));
  ctx.fillStyle = `rgba(2,6,23,${(0.08 + (1 - fade) * 0.08).toFixed(3)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!config) return;
  ctx.fillStyle = config.color;

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    ctx.beginPath();
    ctx.globalAlpha = fade;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;

  if (fading) {
    fadeLevel -= 0.01;
    if (fadeLevel <= 0) {
      fadeLevel = 0;
      fading = false;
      config = null;
      particles = [];
    }
  }

  requestAnimationFrame(loop);
}

export function fadeOutVisual() {
  fading = true;
}
