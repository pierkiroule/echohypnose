import { createCosmos } from "./cosmos.js";
import { createDance } from "./dance.js";
import { createAudioEngine } from "./audio.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐", "🌌", "🪷"];
const SEQUENCE_DURATION = 60000;

const root = document.getElementById("ui-root");
root.innerHTML = `<div class="instruction">Choisis tes 3 émojis du moment</div>`;

const canvas = document.createElement("canvas");
canvas.className = "cosmos";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const cosmos = createCosmos({
  emojis: EMOJIS,
  getBounds: () => ({ width: canvas.width, height: canvas.height })
});

const audio = createAudioEngine();

let selection = [];
let dance = null;
let sequenceStart = 0;
let sequenceActive = false;
let lastTime = performance.now();

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
}

function startSequence() {
  sequenceActive = true;
  sequenceStart = performance.now();
  const positions = cosmos.getSelectionPositions(selection);
  dance = createDance({
    selection,
    positions,
    getBounds: () => ({ width: window.innerWidth, height: window.innerHeight })
  });
  audio.start();
  document.body.classList.add("sequence-active");
}

function endSequence() {
  sequenceActive = false;
  dance = null;
  selection = [];
  cosmos.clearSelection();
  audio.stop();
  document.body.classList.remove("sequence-active");
}

function handlePointer(event) {
  if (sequenceActive) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = cosmos.hitTest(x, y);
  if (!hit) return;

  const alreadySelected = selection.includes(hit);
  if (alreadySelected) {
    updateSelection(selection.filter((emoji) => emoji !== hit));
    return;
  }

  if (selection.length < 3) {
    const next = [...selection, hit];
    updateSelection(next);
    if (next.length === 3) {
      startSequence();
    }
  }
}

function tick(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  cosmos.update(dt, now);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cosmos.drawBackground(ctx);

  let dancePositions = null;
  let fade = 1;
  let speed = 1;

  if (sequenceActive && dance) {
    const elapsed = now - sequenceStart;
    const progress = Math.min(1, elapsed / SEQUENCE_DURATION);
    const fadeStart = 0.85;
    if (progress > fadeStart) {
      fade = Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart));
    }
    const slowStart = 0.72;
    if (progress > slowStart) {
      speed = Math.max(0.3, 1 - (progress - slowStart) / (1 - slowStart));
    }
    const audioLevel = audio.getLevel();
    dancePositions = dance.getPositions(now, audioLevel, speed);

    if (elapsed >= SEQUENCE_DURATION) {
      endSequence();
    }
  }

  cosmos.drawEmojis(ctx, {
    selection,
    dancePositions,
    fadeOthers: selection.length > 0,
    fade
  });

  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", handlePointer);
window.addEventListener("resize", resize);
resize();
requestAnimationFrame(tick);
