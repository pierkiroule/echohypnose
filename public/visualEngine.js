let canvas;
let ctx;
let running = false;
let state = null;
let lastDpr = window.devicePixelRatio || 1;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  lastDpr = dpr;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawScene() {
  if (!state) return;

  const now = performance.now();
  const t = (now - state.start) / state.duration;
  const eased = Math.min(1, t);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const glow = 0.2 + Math.sin(now * 0.002) * 0.1 + state.intensity * 0.3;
  const gradient = ctx.createRadialGradient(
    window.innerWidth / 2,
    window.innerHeight / 2,
    10,
    window.innerWidth / 2,
    window.innerHeight / 2,
    Math.max(window.innerWidth, window.innerHeight) * 0.6
  );
  gradient.addColorStop(0, `rgba(129,140,248,${glow})`);
  gradient.addColorStop(1, "rgba(2,6,23,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.particles.forEach((p) => {
    const drift = Math.sin(now * 0.001 + p.seed) * (0.6 + state.intensity * 1.2);
    p.x += p.vx * (1 + state.intensity);
    p.y += p.vy * (1 + state.intensity);

    if (p.x < -40) p.x = window.innerWidth + 40;
    if (p.x > window.innerWidth + 40) p.x = -40;
    if (p.y < -40) p.y = window.innerHeight + 40;
    if (p.y > window.innerHeight + 40) p.y = -40;

    ctx.beginPath();
    ctx.fillStyle = `rgba(226,232,240,${0.35 + p.alpha * (1 - eased)})`;
    ctx.arc(p.x + drift, p.y - drift, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  if (t >= 1) {
    state = null;
  }
}

function loop() {
  if (!running) return;
  if (window.devicePixelRatio !== lastDpr) resize();

  if (state) {
    drawScene();
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(loop);
}

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

  requestAnimationFrame(loop);
}

export function startVisualScene({ duration = 60000, intensity = 0.5 } = {}) {
  const count = 120;
  state = {
    start: performance.now(),
    duration,
    intensity,
    particles: Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.8,
      seed: Math.random() * Math.PI * 2
    }))
  };
}
