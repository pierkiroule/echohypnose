const DEFAULT_HALF_LIFE = 25;

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function createConstellationEngine({ emojis = [], halfLife = DEFAULT_HALF_LIFE } = {}) {
  const nodes = new Map();
  const edges = new Map();
  const known = new Set(emojis);
  let lastTick = performance.now();

  function ensureNode(emoji) {
    if (!nodes.has(emoji)) nodes.set(emoji, 0);
  }

  function recordSelection(selection, weight = 1) {
    const unique = [...new Set(selection)].filter((emoji) => known.has(emoji));
    if (!unique.length) return;

    unique.forEach((emoji) => {
      ensureNode(emoji);
      nodes.set(emoji, nodes.get(emoji) + weight);
    });

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = pairKey(unique[i], unique[j]);
        edges.set(key, (edges.get(key) || 0) + weight);
      }
    }
  }

  function decay() {
    const now = performance.now();
    const dt = Math.max(0.016, (now - lastTick) / 1000);
    lastTick = now;
    const factor = Math.exp(-dt / halfLife);

    nodes.forEach((value, key) => {
      const next = value * factor;
      if (next < 0.01) nodes.delete(key);
      else nodes.set(key, next);
    });

    edges.forEach((value, key) => {
      const next = value * factor;
      if (next < 0.01) edges.delete(key);
      else edges.set(key, next);
    });
  }

  function getConstellation() {
    const nodeEntries = [...nodes.entries()]
      .map(([emoji, weight]) => ({ emoji, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    const edgeEntries = [...edges.entries()]
      .map(([key, weight]) => {
        const [a, b] = key.split("|");
        return { a, b, weight };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    const maxNode = nodeEntries[0]?.weight || 1;
    const maxEdge = edgeEntries[0]?.weight || 1;

    return {
      nodes: nodeEntries.map((node) => ({
        ...node,
        normalized: node.weight / maxNode
      })),
      edges: edgeEntries.map((edge) => ({
        ...edge,
        normalized: edge.weight / maxEdge
      }))
    };
  }

  return {
    recordSelection,
    decay,
    getConstellation
  };
}
