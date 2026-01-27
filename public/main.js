import { initCosmos, addDrop, clearDrops, setResonance } from "./cosmos.js";
import { createConstellationEngine } from "./constellationEngine.js";
import { initEmojiGrid } from "./emojiGrid.js";
import { startAgentSimulator } from "./agentSimulator.js";
import { initVisual } from "./visualEngine.js";
import { triggerResonance } from "./resonanceEngine.js";

const EMOJIS = ["🌊", "🌫️", "✨", "🌑", "🎐", "🪵", "🕯️", "🧿", "🪐"];
const SCENE_DURATION = 60000;

const engine = createConstellationEngine({ emojis: EMOJIS });
initCosmos({ getConstellation: engine.getConstellation });
initVisual();

let lastSelection = [];
let isResonating = false;

const grid = initEmojiGrid({
  emojis: EMOJIS,
  onSelectionChange: (selection) => {
    lastSelection = selection;
  },
  onDrop: (emoji, position) => {
    addDrop(emoji, position.x, position.y);
  },
  onSelectionComplete: (selection) => {
    engine.recordSelection(selection);
  },
  onValidate: async () => {
    if (isResonating || lastSelection.length === 0) return;
    isResonating = true;
    grid.setBusy(true);
    setResonance(true);

    await triggerResonance({ duration: SCENE_DURATION, intensity: 0.7 });

    setResonance(false);
    clearDrops();
    grid.reset();
    grid.setBusy(false);
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
