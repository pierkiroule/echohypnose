// Ciel boréal · Bulles émojis flottantes
// Canvas BACKGROUND — stable mobile

let canvas, ctx;
let bubbles = [];
let selected = [];
let onToggle = null;
let running = false;

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

  ctx.strokeStyle = "rgba(147,197,253,0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(selected[0].x, selected[0].y);
  selected.slice(1).forEach(b => ctx.lineTo(b.x, b.y));
  ctx.stroke();
}

function loop() {
  ctx.fillStyle = "rgba(2,6,23,0.12)";
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

    ctx.shadowColor = b.selected
      ? "rgba(147,197,253,0.9)"
      : "rgba(255,255,255,0.25)";
    ctx.shadowBlur = b.selected ? 30 : 10;

    ctx.fillText(b.emoji, b.x, b.y);
    ctx.restore();
  });

  requestAnimationFrame(loop);
}
