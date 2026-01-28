import {
  initCosmos,
  clearSelection,
  setInteractionEnabled,
  setResonance,
  setSessionState
} from "./cosmos.js";
import { createConstellationEngine } from "./constellationEngine.js";
import { startAgentSimulator } from "./agentSimulator.js";
import { initVisual } from "./visualEngine.js";
import { startEchohypnosisSession } from "./echohypnosisSession.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐"];
const SCENE_DURATION = 60000;
const RESONANCE_THRESHOLD = 4.5;
const RESONANCE_DECAY = 0.02;
const RESONANCE_RELEASE_MS = 900;

const engine = createConstellationEngine({ emojis: EMOJIS });
let constellationSnapshot = engine.getConstellation();
let currentSession = null;
initVisual();

let isResonating = false;

const root = document.getElementById("ui-root");
root.innerHTML = `
  <div class="ui-shell">
    <div class="ui-top">
      <div class="ui-brand">
        <h1 class="ui-title">Echohypnoz360•°</h1>
        <p class="ui-tagline">Rituel du cosmobulle</p>
      </div>
      <p class="ui-copy">Tapote pour faire résonner le cosmobulle.</p>
    </div>
  </div>
`;

function randomSelection() {
  const pool = [...EMOJIS];
  const selection = [];
  while (selection.length < 3 && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    selection.push(pool.splice(index, 1)[0]);
  }
  return selection;
}

function seedCollectiveGraph(samples = 12) {
  for (let i = 0; i < samples; i += 1) {
    engine.recordSelection(randomSelection(), 0.4);
  }
}

function refreshConstellation() {
  seedCollectiveGraph();
  constellationSnapshot = engine.getConstellation();
}

refreshConstellation();
window.setInterval(refreshConstellation, 15 * 60 * 1000);

let resonanceEnergy = 0;
let lastTap = 0;
let lastHypnoEmoji = null;

function pickHypnoEmoji() {
  const nodes = constellationSnapshot?.nodes || [];
  if (!nodes.length) return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  const weights = nodes.map((node) => {
    const bias = node.emoji === lastHypnoEmoji ? 0.4 : 0;
    return Math.max(0.15, node.normalized + 0.35 - bias);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < nodes.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return nodes[i].emoji;
  }
  return nodes[nodes.length - 1].emoji;
}

async function startHypnoJourney() {
  if (isResonating) return;
  isResonating = true;
  setInteractionEnabled(false);

  const emoji = pickHypnoEmoji();
  lastHypnoEmoji = emoji;
  engine.recordSelection([emoji]);
  refreshConstellation();

  setResonance(true);
  setSessionState({ active: true, selection: [emoji] });
  document.body.classList.add("session-active");

  currentSession = await startEchohypnosisSession([emoji], {
    cycleDuration: SCENE_DURATION,
    onStop: () => {
      document.body.classList.remove("session-active");
      setResonance(false);
      setSessionState({ active: false });
      clearSelection();
      setInteractionEnabled(true);
      isResonating = false;
      currentSession = null;
    }
  });
}

function handleResonanceTap() {
  if (isResonating) return;
  const now = performance.now();
  lastTap = now;
  resonanceEnergy = Math.min(RESONANCE_THRESHOLD * 1.5, resonanceEnergy + 0.85);
  setResonance(true);
}

initCosmos({
  getConstellation: () => constellationSnapshot,
  onSelectionChange: () => {},
  onSelectionComplete: () => {},
  onResonanceTap: handleResonanceTap,
  allowSelection: false
});

function resonanceLoop() {
  if (!isResonating) {
    resonanceEnergy = Math.max(0, resonanceEnergy - RESONANCE_DECAY);
    if (resonanceEnergy < 0.2) {
      setResonance(false);
    }
    if (resonanceEnergy >= RESONANCE_THRESHOLD) {
      const sinceLastTap = performance.now() - lastTap;
      if (sinceLastTap > RESONANCE_RELEASE_MS) {
        resonanceEnergy = 0;
        startHypnoJourney();
      }
    }
  }
  requestAnimationFrame(resonanceLoop);
}

resonanceLoop();

startAgentSimulator({
  emojis: EMOJIS,
  onSignal: (selection) => {
    engine.recordSelection(selection, 0.7);
  }
});

function tick() {
  engine.decay();
  requestAnimationFrame(tick);
}

tick();
