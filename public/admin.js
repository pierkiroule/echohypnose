function parseList(v) {
  if (!v) return [];
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

function buildSet() {
  const label = document.getElementById("label").value || "set-sans-nom";

  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,

    music: {
      pool: parseList(document.getElementById("musicPool").value),
      gain: parseFloat(document.getElementById("musicGain").value),
      lp: 1600
    },

    voice: {
      pool: parseList(document.getElementById("voicePool").value),
      gain: parseFloat(document.getElementById("voiceGain").value),
      count: { calm: 3, dense: 5, agitated: 6 }
    },

    animation: {
      preset: document.getElementById("animPreset").value,
      speed: 0.6,
      intensity: 0.4
    },

    rules: {
      delayStartVoice: 2.0,
      durationMin: 45,
      durationMax: 90
    }
  };
}

function previewSet() {
  const set = buildSet();
  document.getElementById("output").textContent =
    "PREVIEW SET\n\n" + JSON.stringify(set, null, 2);
}

function installSet() {
  const set = buildSet();

  localStorage.setItem(
    "echohypnose.activeSet",
    JSON.stringify(set)
  );

  document.getElementById("output").textContent =
    "SET INSTALLÉ ET ACTIF\n\n" + JSON.stringify(set, null, 2);

  console.log("SET INSTALLED", set);
}
