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
  let attractionTargets = new Map();
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
      if (attractionTargets.has(node.emoji)) {
        const target = attractionTargets.get(node.emoji);
        const dx = target.x - node.x;
        const dy = target.y - node.y;
        const pull = Math.min(1, dt * 4.5);
        node.x += dx * pull;
        node.y += dy * pull;
        node.vx *= 0.6;
        node.vy *= 0.6;
      } else {
        node.x += node.vx * dt;
        node.y += node.vy * dt;
      }
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

  function drawEmojis(ctx, { selection: selectedEmojis, dancePositions, fadeOthers, fade = 1 }) {
    const selectedSet = new Set(selectedEmojis);

    nodes.forEach((node) => {
      if (selectedSet.has(node.emoji)) return;
      if (fadeOthers === "hide") return;
      drawEmoji(ctx, node, {
        selected: false,
        faded: fadeOthers,
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

    if (selectedEmojis.length >= 2) {
      const selectedNodes = selectedEmojis
        .map((emoji) => nodes.find((item) => item.emoji === emoji))
        .filter(Boolean);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(129, 140, 248, ${0.65 * fade})`;
      if (selectedNodes.length === 2) {
        const [a, b] = selectedNodes;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 160) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      } else if (selectedNodes.length >= 3) {
        for (let i = 0; i < selectedNodes.length; i += 1) {
          for (let j = i + 1; j < selectedNodes.length; j += 1) {
            ctx.beginPath();
            ctx.moveTo(selectedNodes[i].x, selectedNodes[i].y);
            ctx.lineTo(selectedNodes[j].x, selectedNodes[j].y);
            ctx.stroke();
          }
        }
      }
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

  function getClosestEmojis(x, y, count, exclude = new Set()) {
    return nodes
      .filter((node) => !exclude.has(node.emoji))
      .map((node) => ({ emoji: node.emoji, dist: Math.hypot(node.x - x, node.y - y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count)
      .map((item) => item.emoji);
  }

  function setSelection(nextSelection) {
    selection = nextSelection;
  }

  function clearSelection() {
    selection = [];
  }

  function setAttractionTargets(nextTargets) {
    attractionTargets = new Map(nextTargets);
  }

  function clearAttractionTargets() {
    attractionTargets = new Map();
  }

  return {
    resize,
    update,
    drawBackground,
    drawEmojis,
    hitTest,
    toWorldPoint,
    getClosestEmojis,
    setSelection,
    clearSelection,
    setAttractionTargets,
    clearAttractionTargets,
    getSelectionPositions
  };
}
