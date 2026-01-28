import { createCosmos } from "./cosmos.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐", "🌌", "🪷"];
const root = document.getElementById("ui-root");
root.innerHTML = `<div class="instruction">Tape pour faire vibrer les émojis jusqu'au triangle</div>`;

const canvas = document.createElement("canvas");
canvas.className = "cosmos";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const cosmos = createCosmos({
  emojis: EMOJIS,
  getBounds: () => ({ width: window.innerWidth, height: window.innerHeight })
});

let selection = [];
let lockedPair = null;
let linkedPairs = [];
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

function pairKey(pair) {
  return pair.slice().sort().join("|");
}

function mergeLinkedPairs(pairs, nextPairs) {
  const nextSet = new Set(pairs.map((pair) => pairKey(pair)));
  nextPairs.forEach((pair) => {
    const key = pairKey(pair);
    if (!nextSet.has(key)) {
      nextSet.add(key);
      pairs.push(pair);
    }
  });
  return pairs;
}

function findTriangleFromPair(pairs, pair) {
  if (!pair) return [];
  const [a, b] = pair;
  for (let i = 0; i < pairs.length; i += 1) {
    const [p1, p2] = pairs[i];
    if (p1 === a && p2 !== b) return [a, b, p2];
    if (p2 === a && p1 !== b) return [a, b, p1];
    if (p1 === b && p2 !== a) return [a, b, p2];
    if (p2 === b && p1 !== a) return [a, b, p1];
  }
  return [];
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const tapPoint = cosmos.toWorldPoint(x, y);
  cosmos.applyResonance(tapPoint.x, tapPoint.y);
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

  const touchingPairs = cosmos.getTouchingPairs();
  linkedPairs = mergeLinkedPairs(linkedPairs, touchingPairs);
  if (!lockedPair && touchingPairs.length) {
    lockedPair = touchingPairs[0];
  }
  const touchingTriangle = findTriangleFromPair(touchingPairs, lockedPair);
  if (touchingTriangle.length !== selection.length || touchingTriangle.some((emoji) => !selection.includes(emoji))) {
    updateSelection(touchingTriangle);
  }
  if (!touchingPairs.length) {
    lockedPair = lockedPair ?? null;
  }

  cosmos.drawEmojis(ctx, {
    selection,
    dancePositions: null,
    fade: 1,
    pairs: linkedPairs,
    highlightPairs: lockedPair ? [lockedPair] : []
  });

  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("touchstart", handleTouch, { passive: false });
window.addEventListener("resize", resize);
resize();
requestAnimationFrame(tick);
