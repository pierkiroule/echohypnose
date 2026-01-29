const STAR_COUNT = 80;

function createStar(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.4 + 0.2,
    drift: (Math.random() - 0.5) * 0.08
  };
}

export function createCosmos({ emojis, getBounds }) {
  const nodes = emojis.map((emoji) => ({
    emoji,
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10,
    size: 22 + Math.random() * 14,
    driftPhase: Math.random() * Math.PI * 2
  }));

  let stars = Array.from({ length: STAR_COUNT }, () =>
    createStar(window.innerWidth, window.innerHeight)
  );
  let networkEdges = [];
  let selection = [];
  let lockedSelection = new Set();
  let particles = [];
  let width = window.innerWidth;
  let height = window.innerHeight;

  function toWorldPoint(x, y) {
    const bounds = getBounds();
    const scaleX = bounds.width / width;
    const scaleY = bounds.height / height;
    return {
      x: x * scaleX,
      y: y * scaleY
    };
  }

  function resize(nextWidth, nextHeight) {
    width = nextWidth;
    height = nextHeight;
    stars = Array.from({ length: STAR_COUNT }, () => createStar(width, height));
  }

  function buildNetworkEdges() {
    const edges = new Set();
    nodes.forEach((node) => {
      const neighbors = nodes
        .filter((candidate) => candidate !== node)
        .map((candidate) => ({
          emoji: candidate.emoji,
          dist: Math.hypot(node.x - candidate.x, node.y - candidate.y)
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      neighbors.forEach((neighbor) => {
        const key = node.emoji < neighbor.emoji
          ? `${node.emoji}|${neighbor.emoji}`
          : `${neighbor.emoji}|${node.emoji}`;
        edges.add(key);
      });
    });
    networkEdges = [...edges].map((key) => key.split("|"));
  }

  buildNetworkEdges();

  function update(dt, now) {
    nodes.forEach((node) => {
      if (lockedSelection.has(node.emoji)) return;
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      node.vx *= 0.97;
      node.vy *= 0.97;
      const padding = 30;
      if (node.x < padding || node.x > width - padding) node.vx *= -1;
      if (node.y < padding || node.y > height - padding) node.vy *= -1;
      const drift = Math.sin(now * 0.0003 + node.driftPhase) * 6;
      node.y += drift * dt;

      if (Math.random() < 0.35) {
        particles.push({
          x: node.x,
          y: node.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 0,
          ttl: 0.8 + Math.random() * 0.6,
          size: 1.2 + Math.random() * 1.6
        });
      }
    });

    particles = particles.filter((particle) => {
      particle.life += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      return particle.life < particle.ttl;
    });
  }

  function drawBackground(ctx) {
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.4,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, "#0b1022");
    gradient.addColorStop(0.7, "#05070f");
    gradient.addColorStop(1, "#02040a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    stars.forEach((star) => {
      star.x += star.drift;
      if (star.x < -10) star.x = width + 10;
      if (star.x > width + 10) star.x = -10;
      ctx.globalAlpha = 0.4 + Math.sin(performance.now() * 0.001 + star.x) * 0.2;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawEmoji(ctx, node, options) {
    const { selected, faded, glow, fade } = options;
    const baseSize = node.size * (selected ? 1.25 : 1);
    const alpha = faded ? 0.35 * fade : 1 * fade;
    ctx.save();
    const starRadius = baseSize * 0.9;
    ctx.globalAlpha = 0.35 * fade;
    ctx.strokeStyle = "rgba(167, 139, 250, 0.7)";
    ctx.lineWidth = 1.2;
    drawStar(ctx, node.x, node.y, starRadius, starRadius * 0.45, 5);
    ctx.stroke();
    if (glow) {
      ctx.shadowColor = "rgba(129, 140, 248, 0.7)";
      ctx.shadowBlur = 18;
    }
    ctx.globalAlpha = alpha;
    ctx.font = `${baseSize}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.emoji, node.x, node.y);
    ctx.restore();
  }

  function drawEmojis(ctx, {
    selection: selectedEmojis,
    dancePositions,
    fade = 1,
    pairs = [],
    highlightPairs = [],
    hideOthers = false
  }) {
    const selectedSet = new Set(selectedEmojis);

    if (particles.length) {
      ctx.save();
      particles.forEach((particle) => {
        const lifeRatio = 1 - particle.life / particle.ttl;
        ctx.globalAlpha = lifeRatio * 0.6 * fade;
        ctx.fillStyle = "rgba(236, 233, 254, 0.9)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    if (networkEdges.length) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.3 * fade})`;
      networkEdges.forEach(([aEmoji, bEmoji]) => {
        const a = nodes.find((item) => item.emoji === aEmoji);
        const b = nodes.find((item) => item.emoji === bEmoji);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    nodes.forEach((node) => {
      if (selectedSet.has(node.emoji)) return;
      if (hideOthers) return;
      drawEmoji(ctx, node, {
        selected: false,
        faded: false,
        glow: false,
        fade
      });
    });

    selectedEmojis.forEach((emoji) => {
      const node = nodes.find((item) => item.emoji === emoji);
      if (!node) return;
      if (dancePositions?.has(emoji)) {
        const pos = dancePositions.get(emoji);
        node.x = pos.x;
        node.y = pos.y;
      }
      drawEmoji(ctx, node, {
        selected: true,
        faded: false,
        glow: true,
        fade
      });
    });

    if (pairs.length > 0) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(129, 140, 248, ${0.55 * fade})`;
      pairs.forEach(([aEmoji, bEmoji]) => {
        const a = nodes.find((item) => item.emoji === aEmoji);
        const b = nodes.find((item) => item.emoji === bEmoji);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    if (highlightPairs.length > 0) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.9 * fade})`;
      highlightPairs.forEach(([aEmoji, bEmoji]) => {
        const a = nodes.find((item) => item.emoji === aEmoji);
        const b = nodes.find((item) => item.emoji === bEmoji);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  function hitTest(x, y) {
    const normalizedPoint = toWorldPoint(x, y);
    let hit = null;
    nodes.forEach((node) => {
      const dist = Math.hypot(normalizedPoint.x - node.x, normalizedPoint.y - node.y);
      if (dist < node.size * 0.7) {
        hit = node.emoji;
      }
    });
    return hit;
  }

  function getSelectionPositions(selected) {
    return selected.map((emoji) => {
      const node = nodes.find((item) => item.emoji === emoji);
      return node ? { x: node.x, y: node.y } : { x: width / 2, y: height / 2 };
    });
  }

  function moveSelectionToward(selected, target, strength = 0.08) {
    if (!selected.length) return;
    const positions = getSelectionPositions(selected);
    const centroid = positions.reduce(
      (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
      { x: 0, y: 0 }
    );
    centroid.x /= positions.length;
    centroid.y /= positions.length;
    const offset = {
      x: target.x - centroid.x,
      y: target.y - centroid.y
    };
    selected.forEach((emoji, index) => {
      const node = nodes.find((item) => item.emoji === emoji);
      if (!node) return;
      const desired = {
        x: positions[index].x + offset.x,
        y: positions[index].y + offset.y
      };
      node.x += (desired.x - node.x) * strength;
      node.y += (desired.y - node.y) * strength;
    });
  }

  function arrangeSelectionTriangle(selected, center, radius = 70, strength = 0.12) {
    if (selected.length !== 3) return;
    const angles = [-Math.PI / 2, (Math.PI * 1) / 6, (Math.PI * 5) / 6];
    selected.forEach((emoji, index) => {
      const node = nodes.find((item) => item.emoji === emoji);
      if (!node) return;
      const target = {
        x: center.x + Math.cos(angles[index]) * radius,
        y: center.y + Math.sin(angles[index]) * radius
      };
      node.x += (target.x - node.x) * strength;
      node.y += (target.y - node.y) * strength;
    });
  }

  function setSelection(nextSelection) {
    selection = nextSelection;
  }

  function clearSelection() {
    selection = [];
  }

  function lockSelection(selected) {
    lockedSelection = new Set(selected);
    lockedSelection.forEach((emoji) => {
      const node = nodes.find((item) => item.emoji === emoji);
      if (!node) return;
      node.vx = 0;
      node.vy = 0;
    });
  }

  function clearLockedSelection() {
    lockedSelection = new Set();
  }

  function applyResonance(x, y) {
    const closest = getClosestEmoji(x, y, lockedSelection);
    if (!closest) return;
    const node = nodes.find((item) => item.emoji === closest);
    if (!node) return;
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.max(40, Math.hypot(dx, dy));
    const force = Math.min(1, 260 / dist);
    const boost = 100 * force;
    node.vx += (dx / dist) * boost;
    node.vy += (dy / dist) * boost;
  }

  function getClosestEmoji(x, y, exclude = new Set()) {
    let closest = null;
    let closestDist = Infinity;
    nodes.forEach((node) => {
      if (exclude.has(node.emoji)) return;
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node.emoji;
      }
    });
    return closest;
  }

  function getTouchingPairs() {
    const threshold = 0.45;
    const pairs = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const ab = Math.hypot(a.x - b.x, a.y - b.y);
        if (ab < (a.size + b.size) * threshold) {
          pairs.push([a.emoji, b.emoji]);
        }
      }
    }
    return pairs;
  }

  function getTouchingTriangle(pairs = getTouchingPairs()) {
    const threshold = 0.45;
    const pairSet = new Set(pairs.map((pair) => pair.slice().sort().join("|")));
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        for (let k = j + 1; k < nodes.length; k += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const c = nodes[k];
          const bc = Math.hypot(b.x - c.x, b.y - c.y);
          const ca = Math.hypot(c.x - a.x, c.y - a.y);
          const pairAB = [a.emoji, b.emoji].sort().join("|");
          if (!pairSet.has(pairAB)) continue;
          if (bc < (b.size + c.size) * threshold && ca < (c.size + a.size) * threshold) {
            return [a.emoji, b.emoji, c.emoji];
          }
        }
      }
    }
    return [];
  }

  function drawStar(ctx, x, y, outerRadius, innerRadius, points) {
    const step = Math.PI / points;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = i * step - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  return {
    resize,
    update,
    drawBackground,
    drawEmojis,
    hitTest,
    toWorldPoint,
    setSelection,
    clearSelection,
    moveSelectionToward,
    arrangeSelectionTriangle,
    lockSelection,
    clearLockedSelection,
    applyResonance,
    getClosestEmoji,
    getTouchingPairs,
    getTouchingTriangle,
    getSelectionPositions
  };
}
