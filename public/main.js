import { initCosmos, clearSelection, setInteractionEnabled, setResonance } from "./cosmos.js";
import { createConstellationEngine } from "./constellationEngine.js";
import { startAgentSimulator } from "./agentSimulator.js";
import { initVisual } from "./visualEngine.js";
import { startEchohypnosisSession } from "./echohypnosisSession.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐"];
const SCENE_DURATION = 60000;

const engine = createConstellationEngine({ emojis: EMOJIS });
initVisual();

let isResonating = false;

const root = document.getElementById("ui-root");
root.innerHTML = `
  <div class="ui-shell">
    <div class="ui-top">
      <p>Bienvenue dans l'inconscient échohypnotique.</p>
      <p>Voici ce que les membres du collectif font résonner actuellement.</p>
    </div>
    <div class="ui-bottom">
      Sélectionne 3 émojis qui t'inspirent, te guident et résonnent pour toi ici et maintenant.
    </div>
  </div>
`;

initCosmos({
  getConstellation: engine.getConstellation,
  onSelectionChange: () => {},
  onSelectionComplete: async (selection) => {
    if (isResonating) return;
    isResonating = true;
    setInteractionEnabled(false);
    engine.recordSelection(selection);
    setResonance(true);

    document.body.classList.add("session-active");
    const session = await startEchohypnosisSession(selection, { duration: SCENE_DURATION });
    await session.done;
    document.body.classList.remove("session-active");

    setResonance(false);
    clearSelection();
    setInteractionEnabled(true);
    isResonating = false;
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
