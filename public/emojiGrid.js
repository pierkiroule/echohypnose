export function initEmojiGrid({ emojis = [], onSelectionChange, onDrop, onSelectionComplete, onValidate }) {
  const root = document.getElementById("ui-root");
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "ui-shell";

  const label = document.createElement("div");
  label.className = "constellation-label";
  label.textContent = "Constellation vivante";

  const panel = document.createElement("div");
  panel.className = "ui-panel";

  const header = document.createElement("div");
  header.className = "ui-header";
  header.textContent = "Echohypnose";

  const status = document.createElement("div");
  status.className = "ui-status";
  status.textContent = "Choisis trois signes puis dépose-les dans le ciel.";

  const grid = document.createElement("div");
  grid.className = "emoji-grid";

  const actions = document.createElement("div");
  actions.className = "ui-actions";

  const actionButton = document.createElement("button");
  actionButton.className = "action-button";
  actionButton.textContent = "Déclencher la scène";
  actionButton.disabled = true;

  actions.appendChild(actionButton);

  panel.appendChild(header);
  panel.appendChild(status);
  panel.appendChild(grid);
  panel.appendChild(actions);

  shell.appendChild(label);
  shell.appendChild(panel);
  root.appendChild(shell);

  const state = {
    selected: [],
    dropped: [],
    dragging: null
  };

  function updateStatus() {
    const remaining = Math.max(0, state.selected.length - state.dropped.length);
    if (!state.selected.length) {
      status.textContent = "Choisis trois signes puis dépose-les dans le ciel.";
    } else if (remaining > 0) {
      status.textContent = `Dépose encore ${remaining} signe${remaining > 1 ? "s" : ""} dans le ciel.`;
    } else {
      status.textContent = "Constellation déposée. Tu peux déclencher la scène.";
    }
  }

  function notifySelection() {
    onSelectionChange?.(state.selected);
    updateStatus();
  }

  function setButtonState() {
    actionButton.disabled = state.selected.length === 0 || state.dropped.length !== state.selected.length;
  }

  function toggleEmoji(emoji, button) {
    const index = state.selected.indexOf(emoji);
    if (index >= 0) {
      state.selected.splice(index, 1);
      state.dropped = state.dropped.filter((item) => item !== emoji);
      button.classList.remove("selected");
      button.classList.remove("used");
    } else if (state.selected.length < 3) {
      state.selected.push(emoji);
      button.classList.add("selected");
    }
    setButtonState();
    notifySelection();
  }

  function createGhost(emoji) {
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.textContent = emoji;
    document.body.appendChild(ghost);
    return ghost;
  }

  function onPointerDown(event, emoji, button) {
    event.preventDefault();
    if (!state.selected.includes(emoji)) {
      if (state.selected.length >= 3) return;
      state.selected.push(emoji);
      button.classList.add("selected");
    }

    if (state.dropped.includes(emoji)) return;

    const ghost = createGhost(emoji);
    state.dragging = { emoji, ghost };

    const move = (moveEvent) => {
      ghost.style.left = `${moveEvent.clientX}px`;
      ghost.style.top = `${moveEvent.clientY}px`;
    };

    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      ghost.remove();

      const gridRect = panel.getBoundingClientRect();
      const droppedInGrid =
        upEvent.clientX >= gridRect.left &&
        upEvent.clientX <= gridRect.right &&
        upEvent.clientY >= gridRect.top &&
        upEvent.clientY <= gridRect.bottom;

      if (!droppedInGrid) {
        state.dropped.push(emoji);
        button.classList.add("used");
        onDrop?.(emoji, { x: upEvent.clientX, y: upEvent.clientY });

        if (state.dropped.length === state.selected.length) {
          onSelectionComplete?.([...state.selected]);
        }
      }

      state.dragging = null;
      setButtonState();
      notifySelection();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    move(event);

    setButtonState();
    notifySelection();
  }

  emojis.forEach((emoji) => {
    const button = document.createElement("button");
    button.className = "emoji-button";
    button.textContent = emoji;
    button.type = "button";

    button.addEventListener("click", () => {
      if (state.dragging) return;
      toggleEmoji(emoji, button);
    });

    button.addEventListener("pointerdown", (event) => onPointerDown(event, emoji, button));
    grid.appendChild(button);
  });

  actionButton.addEventListener("click", () => {
    if (actionButton.disabled) return;
    onValidate?.([...state.selected]);
  });

  notifySelection();

  return {
    reset() {
      state.selected = [];
      state.dropped = [];
      [...grid.children].forEach((button) => {
        button.classList.remove("selected", "used");
      });
      setButtonState();
      updateStatus();
    },
    setBusy(isBusy) {
      actionButton.disabled = isBusy || state.selected.length === 0 || state.dropped.length !== state.selected.length;
      [...grid.children].forEach((button) => {
        button.disabled = isBusy;
      });
    }
  };
}
