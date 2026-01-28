import {
  initCosmos,
  clearSelection,
  setInteractionEnabled,
  setResonance,
  setSessionState,
  setAllowSelection
} from "./cosmos.js";
import { createConstellationEngine } from "./constellationEngine.js";
import { startAgentSimulator } from "./agentSimulator.js";
import { initVisual } from "./visualEngine.js";
import { startEchohypnosisSession } from "./echohypnosisSession.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐"];
const SCENE_DURATION = 60000;

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
        <h1 class="ui-title">EchoHypno•°</h1>
        <p class="ui-tagline">Rituel narratif cosmique</p>
      </div>
      <p class="ui-copy" id="ui-instruction"></p>
      <p class="ui-subcopy" id="ui-subcopy"></p>
    </div>
    <div class="ui-bottom">
      <div class="ui-haimoji-label">Haïmoji</div>
      <div class="ui-haimoji" id="ui-haimoji">• • •</div>
      <p class="ui-progress" id="ui-progress"></p>
    </div>
  </div>
`;

const instructionEl = document.getElementById("ui-instruction");
const subcopyEl = document.getElementById("ui-subcopy");
const haimojiEl = document.getElementById("ui-haimoji");
const progressEl = document.getElementById("ui-progress");

const uiState = {
  awakened: false,
  selection: [],
  tapCount: 0,
  lastTapAt: 0
};

function formatHaimoji(selection) {
  if (!selection.length) return "• • •";
  return selection
    .concat(Array.from({ length: Math.max(0, 3 - selection.length) }, () => "•"))
    .join(" ");
}

function updateUiCopy() {
  if (!uiState.awakened) {
    instructionEl.textContent =
      "Toc toc toc ! Tapez 3 fois ici ou là pour réveiller l'inconscient Cosmoji.";
    subcopyEl.textContent =
      "De là émerge la constellation du moment. Laisse-la t'appeler.";
    progressEl.textContent = `Éveil en cours · ${uiState.tapCount}/3`;
  } else if (uiState.selection.length < 3) {
    instructionEl.textContent =
      "La constellation du moment apparaît. Choisis 3 émojis dans cette trame.";
    subcopyEl.textContent =
      "Ils s'alignent et forment le haïmoji : le message secret du Cosmoji.";
    progressEl.textContent = `Choix en cours · ${uiState.selection.length}/3`;
  } else {
    instructionEl.textContent = "Le haïmoji s'aligne. Contemple le message sensoriel.";
    subcopyEl.textContent = "Le Cosmoji murmure à ton inconscient.";
    progressEl.textContent = "Transmission en cours · 3/3";
  }
  haimojiEl.textContent = formatHaimoji(uiState.selection);
}

updateUiCopy();

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

async function startHypnoJourney(selection) {
  if (isResonating) return;
  isResonating = true;
  setInteractionEnabled(false);
  setAllowSelection(false);

  const chosenSelection = selection?.length ? selection : [pickHypnoEmoji()];
  lastHypnoEmoji = chosenSelection[chosenSelection.length - 1];
  engine.recordSelection(chosenSelection);
  refreshConstellation();

  setResonance(true);
  setSessionState({ active: true, selection: chosenSelection });
  document.body.classList.add("session-active");

  currentSession = await startEchohypnosisSession(chosenSelection, {
    cycleDuration: SCENE_DURATION,
    onStop: () => {
      document.body.classList.remove("session-active");
      setResonance(false);
      setSessionState({ active: false });
      clearSelection();
      setInteractionEnabled(true);
      setAllowSelection(false);
      isResonating = false;
      currentSession = null;
      uiState.awakened = false;
      uiState.selection = [];
      uiState.tapCount = 0;
      updateUiCopy();
    }
  });
}

function handleResonanceTap() {
  if (isResonating) return;
  if (!uiState.awakened) {
    const now = Date.now();
    if (now - uiState.lastTapAt > 2200) {
      uiState.tapCount = 0;
    }
    uiState.tapCount = Math.min(3, uiState.tapCount + 1);
    uiState.lastTapAt = now;
    updateUiCopy();
  }
  setResonance(true);
}

initCosmos({
  getConstellation: () => constellationSnapshot,
  onSelectionChange: (selection) => {
    uiState.selection = selection;
    updateUiCopy();
  },
  onSelectionComplete: (selection) => {
    uiState.selection = selection;
    updateUiCopy();
    startHypnoJourney(selection);
  },
  onResonanceTap: handleResonanceTap,
  onResonanceComplete: () => {
    uiState.awakened = true;
    uiState.tapCount = 3;
    updateUiCopy();
    setAllowSelection(true);
    setResonance(false);
  },
  allowSelection: false
});

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
