// Traduction symbolique séquence -> paramètres audio

export function interpretSequence(seq) {
  const [a, b, c] = seq;

  return {
    music: mapMusic(a),
    mood: mapMood(b),
    voice: mapVoice(c)
  };
}

function mapMusic(e) {
  switch (e) {
    case "🌊": return ["m02.mp3"];
    case "🌫️": return ["m01.mp3"];
    case "🌑": return ["m03.mp3"];
    default: return ["m01.mp3"];
  }
}

function mapMood(e) {
  switch (e) {
    case "🎐": return "calm";
    case "🪵": return "dense";
    case "🕯️": return "agitated";
    default: return "calm";
  }
}

function mapVoice(e) {
  switch (e) {
    case "✨": return ["v01.mp3"];
    case "🧿": return ["v02.mp3"];
    case "🪐": return ["v03.mp3"];
    default: return ["v01.mp3"];
  }
}
