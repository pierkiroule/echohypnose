export const socket = io();

export function onField(cb) {
  socket.on("field", cb);
}

export function sendEcho({ emoji, tag }) {
  socket.emit("echo", { emoji, tag });
}

export function sendResonance() {
  socket.emit("resonance");
}
