import { createCosmos } from "./cosmos.js";
import { startEchohypnosisSession } from "./echohypnosisSession.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐", "🌌", "🪷"];
const root = document.getElementById("ui-root");
root.innerHTML = `<div class="instruction">Toc toc toc pour lancer l'onde et choisir les 3 premiers émojis</div>`;

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
let tapCount = 0;
let waveSelections = [];
let waveActive = false;
let waveOrigin = null;
let waveStart = 0;
let showNetwork = true;

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
  if (!selectionLocked) {
    showNetwork = selection.length !== 3;
  }
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
  showNetwork = false;
  document.body.classList.add("sequence-active");
  session = await startEchohypnosisSession(selection, {
    cycleDuration: 60000,
    onStop: () => {
      session = null;
      selectionLocked = false;
      showNetwork = true;
      document.body.classList.remove("sequence-active");
      tapCount = 0;
      waveSelections = [];
      waveActive = false;
    }
  });
}

function startWave(origin) {
  waveActive = true;
  waveOrigin = origin;
  waveStart = performance.now();
  waveSelections = [];
  updateSelection([]);
  tapWaves = [{ x: origin.x, y: origin.y, start: waveStart, type: "pulse" }];
  cosmos.applyResonance(origin.x, origin.y);
}

function registerWaveHit(emoji) {
  if (waveSelections.includes(emoji)) return;
  waveSelections.push(emoji);
  updateSelection([...waveSelections]);
}

function handleWaveSelection(now) {
  if (!waveActive || !waveOrigin) return;
  const elapsed = now - waveStart;
  const duration = 1500;
  const progress = Math.min(1, elapsed / duration);
  const radius = 30 + progress * 220;
  const nodes = cosmos.getSelectionPositions(EMOJIS);
  const candidates = nodes
    .map((pos, index) => ({
      emoji: EMOJIS[index],
      dist: Math.hypot(pos.x - waveOrigin.x, pos.y - waveOrigin.y)
    }))
    .filter((candidate) => candidate.dist <= radius + 18 && !waveSelections.includes(candidate.emoji))
    .sort((a, b) => a.dist - b.dist);
  candidates.forEach((candidate) => {
    if (waveSelections.length >= 3) return;
    registerWaveHit(candidate.emoji);
  });
  if (progress >= 1 || waveSelections.length >= 3) {
    waveActive = false;
  }
}

function handlePointer(event) {
  if (selectionLocked) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  tapCount += 1;
  if (tapCount < 3) return;
  if (waveActive) return;
  tapCount = 0;
  const tapPoint = cosmos.toWorldPoint(x, y);
  startWave(tapPoint);
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

  tapWaves = tapWaves.filter((wave) => now - wave.start < 1500);
  tapWaves.forEach((wave) => {
    const progress = Math.min(1, (now - wave.start) / 1500);
    const radius = 30 + progress * 220;
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
    hideOthers: selection.length === 3,
    showNetwork
  });

  ctx.restore();

  handleWaveSelection(now);

  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("touchstart", handleTouch, { passive: false });
window.addEventListener("resize", resize);
resize();
renderSelectionLine();
requestAnimationFrame(tick);
