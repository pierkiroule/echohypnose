import { createCosmos } from "./cosmos.js";
import { startEchohypnosisSession } from "./echohypnosisSession.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐", "🌌", "🪷"];
const root = document.getElementById("ui-root");
root.innerHTML = `<div class="instruction">Choisis trois émojis dans la constellation</div>`;

const selectionLine = document.createElement("div");
selectionLine.className = "selection-line";
document.body.appendChild(selectionLine);

const canvas = document.createElement("canvas");
canvas.className = "cosmos";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const cosmos = createCosmos({
  emojis: EMOJIS,
  getBounds: () => ({ width: window.innerWidth, height: window.innerHeight })
});

let selection = [];
let tapWaves = [];
let cameraZoom = 1;
let lastTime = performance.now();
let session = null;
let selectionLocked = false;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cosmos.resize(window.innerWidth, window.innerHeight);
}

function updateSelection(newSelection) {
  selection = newSelection;
  cosmos.setSelection(selection);
  renderSelectionLine();
  if (selection.length === 3) {
    activateSession();
  }
}

function renderSelectionLine() {
  selectionLine.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const slot = document.createElement("span");
    slot.className = "selection-slot";
    if (selection[i]) {
      slot.classList.add("filled");
      slot.textContent = selection[i];
    } else {
      slot.textContent = "·";
    }
    selectionLine.appendChild(slot);
  }
}

async function activateSession() {
  if (session || selection.length !== 3) return;
  selectionLocked = true;
  document.body.classList.add("sequence-active");
  session = await startEchohypnosisSession(selection, {
    onStop: () => {
      session = null;
      selectionLocked = false;
      document.body.classList.remove("sequence-active");
    }
  });
}

function toggleEmojiSelection(emoji) {
  if (selectionLocked) return;
  const index = selection.indexOf(emoji);
  if (index > -1) {
    const next = [...selection.slice(0, index), ...selection.slice(index + 1)];
    updateSelection(next);
    return;
  }
  if (selection.length >= 3) return;
  updateSelection([...selection, emoji]);
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = cosmos.hitTest(x, y);
  if (hit) {
    toggleEmojiSelection(hit);
    return;
  }
  const tapPoint = cosmos.toWorldPoint(x, y);
  cosmos.applyResonance(tapPoint.x, tapPoint.y);
  tapWaves.push({ x: tapPoint.x, y: tapPoint.y, start: performance.now() });
}

function handleTouch(event) {
  if (!event.touches.length) return;
  event.preventDefault();
  const touch = event.touches[0];
  handlePointer(touch);
}

function tick(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  cosmos.update(dt, now);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cosmos.drawBackground(ctx);

  const targetZoom = selection.length === 3 ? 1.35 : 1;
  cameraZoom += (targetZoom - cameraZoom) * 0.08;

  if (selection.length === 3) {
    cosmos.lockSelection(selection);
  } else {
    cosmos.clearLockedSelection();
  }

  ctx.save();
  ctx.translate(window.innerWidth * 0.5, window.innerHeight * 0.5);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-window.innerWidth * 0.5, -window.innerHeight * 0.5);

  tapWaves = tapWaves.filter((wave) => now - wave.start < 1000);
  tapWaves.forEach((wave) => {
    const progress = Math.min(1, (now - wave.start) / 1000);
    const radius = 30 + progress * 180;
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.35;
    ctx.strokeStyle = "rgba(167, 139, 250, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  cosmos.drawEmojis(ctx, {
    selection,
    dancePositions: null,
    fade: 1,
    hideOthers: false
  });

  ctx.restore();

  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("touchstart", handleTouch, { passive: false });
window.addEventListener("resize", resize);
resize();
renderSelectionLine();
requestAnimationFrame(tick);
