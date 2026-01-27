import { interpretSequence } from "./interpretSequence.js";
import { interpretVisual } from "./interpretVisual.js";
import { audioBus, initAudio, resumeAudioContext, triggerResonanceOnce } from "./resonance.js";
import { fadeOutVisual, initVisual, triggerVisual } from "./visualEngine.js";
import {
  dissolveSelection,
  initSky,
  setInteractionEnabled,
  setPulseLevel,
  startBreathing
} from "./skyConstellation.js";

let sequence = [];
let isResonating = false;
let isBreathing = false;
let pulseHandle = null;

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
btn.style.zIndex = "2";
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

function stopPulseLoop() {
  if (pulseHandle) {
    cancelAnimationFrame(pulseHandle);
    pulseHandle = null;
  }
  setPulseLevel(0);
}

function startPulseLoop(analyser) {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const step = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length / 255;
    setPulseLevel(avg);
    pulseHandle = requestAnimationFrame(step);
  };
  pulseHandle = requestAnimationFrame(step);
}

// ---------- validation ----------
btn.onclick = async () => {
  if (!sequence.length || isResonating || isBreathing) return;
  isBreathing = true;
  btn.disabled = true;
  btn.style.opacity = "0.3";
  setInteractionEnabled(false);

  await ensureAudio();
  await resumeAudioContext();

  await startBreathing({ cycles: 2.5, duration: 9000 });
  isBreathing = false;
  if (sequence.length === 0) {
    setInteractionEnabled(true);
    btn.disabled = true;
    btn.style.opacity = "0.3";
    return;
  }
  isResonating = true;

  const audioCfg = interpretSequence(sequence);
  const visualCfg = interpretVisual(sequence);

  triggerVisual(visualCfg);
  const resonance = await triggerResonanceOnce(audioCfg);
  if (resonance?.done) {
    startPulseLoop(audioBus.analyser);
    await resonance.done;
  }

  stopPulseLoop();
  fadeOutVisual();
  await dissolveSelection();
  setInteractionEnabled(true);
  isResonating = false;
  btn.disabled = sequence.length === 0;
  btn.style.opacity = sequence.length ? "1" : "0.3";
};
