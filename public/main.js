import { createCosmos } from "./cosmos.js";
import { createDance } from "./dance.js";
import { createAudioEngine } from "./audio.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐", "🌌", "🪷"];
const SEQUENCE_DURATION = 60000;

const root = document.getElementById("ui-root");
root.innerHTML = `<div class="instruction">Tape pour attirer les émojis et tracer ta constellation</div>`;

const canvas = document.createElement("canvas");
canvas.className = "cosmos";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const cosmos = createCosmos({
  emojis: EMOJIS,
  getBounds: () => ({ width: window.innerWidth, height: window.innerHeight })
});

const audio = createAudioEngine();

let selection = [];
let dance = null;
let sequenceStart = 0;
let sequenceActive = false;
let tapStage = 0;
let hideOthers = false;
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
  cosmos.clearAttractionTargets();
  tapStage = 0;
  hideOthers = false;
  audio.stop();
  document.body.classList.remove("sequence-active");
}

function handlePointer(event) {
  if (sequenceActive) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const tapPoint = cosmos.toWorldPoint(x, y);

  if (tapStage === 0) {
    const nearest = cosmos.getClosestEmojis(tapPoint.x, tapPoint.y, 2);
    if (nearest.length < 2) return;
    selection = nearest;
    updateSelection(selection);
    const offset = 40;
    const targets = new Map([
      [nearest[0], { x: tapPoint.x - offset, y: tapPoint.y }],
      [nearest[1], { x: tapPoint.x + offset, y: tapPoint.y }]
    ]);
    cosmos.setAttractionTargets(targets);
    tapStage = 1;
    return;
  }

  if (tapStage === 1) {
    const exclude = new Set(selection);
    const [closest] = cosmos.getClosestEmojis(tapPoint.x, tapPoint.y, 1, exclude);
    if (!closest) return;
    selection = [...selection, closest];
    updateSelection(selection);
    hideOthers = true;
    const radius = 55;
    const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    const targets = new Map(
      selection.map((emoji, index) => [
        emoji,
        {
          x: tapPoint.x + Math.cos(angles[index]) * radius,
          y: tapPoint.y + Math.sin(angles[index]) * radius
        }
      ])
    );
    cosmos.setAttractionTargets(targets);
    tapStage = 2;
    startSequence();
  }
}

function handleTouch(event) {
  if (sequenceActive) return;
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
    fadeOthers: hideOthers ? "hide" : selection.length > 0,
    fade
  });

  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("touchstart", handleTouch, { passive: false });
window.addEventListener("resize", resize);
resize();
requestAnimationFrame(tick);
