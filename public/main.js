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
        <h1 class="ui-title">Echohypno•°</h1>
        <p class="ui-tagline">Laisser résonner l'inconscient partagé</p>
      </div>
      <p class="ui-copy">Bienvenue dans l'inconscient échohypnotique.</p>
      <p class="ui-copy">Voici ce que les membres du collectif font résonner actuellement.</p>
    </div>
    <div class="ui-bottom">
      Sélectionne 3 émojis qui t'inspirent, te guident et résonnent pour toi ici et maintenant.
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

initCosmos({
  getConstellation: () => constellationSnapshot,
  onSelectionChange: () => {},
  onSelectionComplete: async (selection) => {
    if (isResonating) return;
    isResonating = true;
    setInteractionEnabled(false);
    engine.recordSelection(selection);
    refreshConstellation();
    setResonance(true);
    setSessionState({ active: true, selection });

    document.body.classList.add("session-active");
    currentSession = await startEchohypnosisSession(selection, {
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
