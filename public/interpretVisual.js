// Séquence -> paramètres visuels

export function interpretVisual(seq) {
  const [a, b, c] = seq;

  return {
    color: mapColor(a),
    motion: mapMotion(b),
    spread: mapSpread(c)
  };
}

function mapColor(e) {
  switch (e) {
    case "🌊": return "#3b82f6";
    case "🌫️": return "#94a3b8";
    case "🌑": return "#020617";
    case "✨": return "#fde68a";
    case "🪐": return "#a78bfa";
    default: return "#64748b";
  }
}

function mapMotion(e) {
  switch (e) {
    case "🎐": return 0.3;   // doux
    case "🪵": return 0.6;   // dense
    case "🕯️": return 1.0;  // agité
    default: return 0.4;
  }
}

function mapSpread(e) {
  switch (e) {
    case "✨": return 1.2;
    case "🧿": return 0.9;
    case "🪐": return 1.6;
    default: return 1.0;
  }
}
