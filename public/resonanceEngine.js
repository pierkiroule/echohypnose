import { resumeAudio, startAudioScene } from "./audioEngine.js";
import { startVisualScene } from "./visualEngine.js";

let activeTimeout = null;
let running = false;

export async function triggerResonance({ duration = 60000, intensity = 0.6 } = {}) {
  if (running) return;
  running = true;

  await resumeAudio();
  const audio = startAudioScene({ duration, intensity });
  startVisualScene({ duration, intensity });

  return new Promise((resolve) => {
    activeTimeout = window.setTimeout(() => {
      audio.stop();
      activeTimeout = null;
      running = false;
      resolve();
    }, duration);
  });
}

export function cancelResonance() {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  running = false;
}
