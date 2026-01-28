const TWO_PI = Math.PI * 2;

function averagePosition(positions) {
  const sum = positions.reduce(
    (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length
  };
}

export function createDance({ selection, positions, getBounds }) {
  const baseCenter = averagePosition(positions);
  const baseAngles = selection.map((_, index) => (TWO_PI / selection.length) * index);
  const startTime = performance.now();

  function getPositions(now, audioLevel, speed) {
    const { width, height } = getBounds();
    const centerTarget = {
      x: width * 0.5,
      y: height * 0.5
    };
    const approach = Math.min(1, (now - startTime) / 4000);
    const center = {
      x: baseCenter.x + (centerTarget.x - baseCenter.x) * approach,
      y: baseCenter.y + (centerTarget.y - baseCenter.y) * approach
    };
    const time = now * 0.001 * speed;
    const radiusBase = Math.min(width, height) * 0.12;
    const audioPulse = radiusBase * (0.2 + audioLevel * 0.5);

    const positionsMap = new Map();
    selection.forEach((emoji, index) => {
      const angle = baseAngles[index] + time * 0.6 + Math.sin(time * 0.4) * 0.2;
      const oscillation = Math.sin(time * 1.4 + index) * radiusBase * 0.18;
      const radius = radiusBase + oscillation + audioPulse * Math.sin(time * 1.1 + index * 1.7);
      const linkedOffset = Math.sin(time * 0.9 + index * 2.1) * radiusBase * 0.15;

      const x = center.x + Math.cos(angle) * radius + Math.cos(time * 0.7) * linkedOffset;
      const y = center.y + Math.sin(angle) * radius + Math.sin(time * 0.5) * linkedOffset;

      positionsMap.set(emoji, { x, y });
    });

    return positionsMap;
  }

  return { getPositions };
}
