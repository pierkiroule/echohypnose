import { interpretSequence } from "./interpretSequence.js";
import { interpretVisual } from "./interpretVisual.js";
import { initAudio, triggerResonanceOnce } from "./resonance.js";
import { initVisual, triggerVisual } from "./visualEngine.js";
import { initSky } from "./skyConstellation.js";

let sequence = [];

// ---------- UI ----------
const btn = document.createElement("button");
btn.textContent = "Résonance de l’instant présent";
btn.style.position = "fixed";
btn.style.bottom = "24px";
btn.style.left = "50%";
btn.style.transform = "translateX(-50%)";
btn.style.padding = "12px 24px";
btn.style.borderRadius = "999px";
btn.style.border = "none";
btn.style.background = "#6366f1";
btn.style.color = "white";
btn.style.opacity = "0.3";
btn.disabled = true;
document.body.appendChild(btn);

// ---------- audio guard ----------
let audioReady = false;
async function ensureAudio() {
  if (audioReady) return;
  await initAudio();
  audioReady = true;
}

// ---------- init visual ----------
initVisual();

// ---------- init sky ----------
initSky({
  emojis: ["🌊","🌫️","✨","🌑","🎐","🪵","🕯️","🧿","🪐"],
  onToggle: (seq) => {
    sequence = seq;
    btn.disabled = sequence.length === 0;
    btn.style.opacity = sequence.length ? "1" : "0.3";
  }
});

// ---------- validation ----------
btn.onclick = async () => {
  if (!sequence.length) return;

  await ensureAudio();

  const audioCfg = interpretSequence(sequence);
  const visualCfg = interpretVisual(sequence);

  triggerVisual(visualCfg);
  triggerResonanceOnce(audioCfg);
};
