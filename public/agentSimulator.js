function randomSelection(emojis) {
  const count = 1 + Math.floor(Math.random() * 3);
  const pool = [...emojis];
  const selection = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * pool.length);
    selection.push(pool.splice(index, 1)[0]);
  }
  return selection;
}

export function startAgentSimulator({ emojis = [], onSignal }) {
  const timers = new Array(10).fill(null);

  function scheduleAgent(index) {
    const delay = 1200 + Math.random() * 3200;
    timers[index] = window.setTimeout(() => {
      onSignal?.(randomSelection(emojis));
      scheduleAgent(index);
    }, delay);
  }

  for (let i = 0; i < 10; i++) {
    scheduleAgent(i);
  }

  return {
    stop() {
      timers.forEach((timer) => clearTimeout(timer));
    }
  };
}
