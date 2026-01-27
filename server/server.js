const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

function now() { return Date.now(); }

const fieldState = {
  echoCount: 0,
  lastActivity: 0,
  emojiHistogram: {}, // { "🌫️": 12, ... }
  tagHistogram: {},   // { "flou": 5, ... }
  intensity: 0,       // 0..1
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function bumpIntensity() {
  // Intensité monte vite, redescend lentement via decay
  fieldState.intensity = clamp01(fieldState.intensity + 0.08);
}

function decayIntensity() {
  const idleMs = now() - fieldState.lastActivity;
  // decay plus fort si inactif
  const decay = idleMs > 15000 ? 0.05 : 0.015;
  fieldState.intensity = clamp01(fieldState.intensity - decay);
}

setInterval(() => {
  decayIntensity();
  io.emit("field", fieldState);
}, 1000);

io.on("connection", (socket) => {
  socket.emit("field", fieldState);

  socket.on("echo", (payload) => {
    try {
      const emoji = (payload && payload.emoji) || "🔘";
      const tag = (payload && payload.tag) || "calme";

      fieldState.echoCount += 1;
      fieldState.lastActivity = now();
      fieldState.emojiHistogram[emoji] = (fieldState.emojiHistogram[emoji] || 0) + 1;
      fieldState.tagHistogram[tag] = (fieldState.tagHistogram[tag] || 0) + 1;

      bumpIntensity();
      io.emit("field", fieldState);
    } catch (e) {
      // ignore
    }
  });

  socket.on("resonance", () => {
    // Optionnel: on peut faire monter un peu l’intensité collective
    fieldState.lastActivity = now();
    fieldState.intensity = clamp01(fieldState.intensity + 0.12);
    io.emit("field", fieldState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Echohypnose POC on http://0.0.0.0:" + PORT);
});
