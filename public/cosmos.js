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
  let selection = [];
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

  function update(dt, now) {
    nodes.forEach((node) => {
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      const padding = 30;
      if (node.x < padding || node.x > width - padding) node.vx *= -1;
      if (node.y < padding || node.y > height - padding) node.vy *= -1;
      const drift = Math.sin(now * 0.0003 + node.driftPhase) * 6;
      node.y += drift * dt;
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
    highlightPairs = []
  }) {
    const selectedSet = new Set(selectedEmojis);

    nodes.forEach((node) => {
      if (selectedSet.has(node.emoji)) return;
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

    if (selectedEmojis.length === 3) {
      const selectedNodes = selectedEmojis
        .map((emoji) => nodes.find((item) => item.emoji === emoji))
        .filter(Boolean);
      if (selectedNodes.length === 3) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(129, 140, 248, ${0.7 * fade})`;
        ctx.beginPath();
        ctx.moveTo(selectedNodes[0].x, selectedNodes[0].y);
        ctx.lineTo(selectedNodes[1].x, selectedNodes[1].y);
        ctx.lineTo(selectedNodes[2].x, selectedNodes[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
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

  function setSelection(nextSelection) {
    selection = nextSelection;
  }

  function clearSelection() {
    selection = [];
  }

  function applyResonance(x, y) {
    const closest = getClosestEmoji(x, y);
    if (!closest) return;
    const node = nodes.find((item) => item.emoji === closest);
    if (!node) return;
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = Math.max(40, Math.hypot(dx, dy));
    const force = Math.min(1, 260 / dist);
    const boost = 140 * force;
    node.vx += (dx / dist) * boost;
    node.vy += (dy / dist) * boost;
  }

  function getClosestEmoji(x, y) {
    let closest = null;
    let closestDist = Infinity;
    nodes.forEach((node) => {
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
    applyResonance,
    getClosestEmoji,
    getTouchingPairs,
    getTouchingTriangle,
    getSelectionPositions
  };
}
