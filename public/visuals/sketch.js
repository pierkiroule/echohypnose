import { field } from "../field.js";
import { audioBus } from "../resonance.js";

let fft;
let bass = 0, mid = 0, high = 0;
let t = 0;

const PARTICLES = [];
let COUNT = 420;

function lerp(a, b, k) {
  return a + (b - a) * k;
}

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.r = random(40, min(width, height) * 0.48);
    this.a = random(TWO_PI);
    this.z = random(-1, 1); // profondeur simulée
    this.speed = random(0.0002, 0.001);
    this.wobble = random(0.5, 2.5);
    this.size = random(0.5, 1.6);
  }

  update(intensity) {
    this.a += this.speed * (0.4 + intensity);
    this.r += sin(t * this.wobble + this.z * 4) * 0.05;
  }

  draw(cx, cy, bass, mid, high, intensity) {
    const drift = 1 + bass * 80;
    const x =
      cx +
      cos(this.a) * this.r +
      sin(t + this.z * 10) * drift;

    const y =
      cy +
      sin(this.a * 1.03) * this.r +
      cos(t * 1.2 + this.z * 10) * drift;

    const alpha =
      10 +
      (1 - abs(this.z)) * 30 +
      high * 80;

    stroke(255, 255, 255, alpha);
    strokeWeight(this.size + mid * 2);
    point(x, y);
  }
}

window.setup = function () {
  createCanvas(window.innerWidth, window.innerHeight);
  pixelDensity(1);
  fft = new Uint8Array(512);

  for (let i = 0; i < COUNT; i++) {
    PARTICLES.push(new Particle());
  }

  background(8, 8, 10);
};

window.windowResized = function () {
  resizeCanvas(window.innerWidth, window.innerHeight);
  background(8, 8, 10);
};

window.draw = function () {
  // fond avec rémanence
  noStroke();
  fill(8, 8, 10, 22);
  rect(0, 0, width, height);

  // audio analysis
  if (audioBus.analyser) {
    audioBus.analyser.getByteFrequencyData(fft);

    let l = 0, m = 0, h = 0;
    for (let i = 0; i < 40; i++) l += fft[i];
    for (let i = 90; i < 170; i++) m += fft[i];
    for (let i = 220; i < 320; i++) h += fft[i];

    bass = lerp(bass, l / 40 / 255, 0.06);
    mid  = lerp(mid,  m / 80 / 255, 0.06);
    high = lerp(high, h / 100 / 255, 0.06);
  } else {
    bass = lerp(bass, 0, 0.03);
    mid  = lerp(mid,  0, 0.03);
    high = lerp(high, 0, 0.03);
  }

  const { intensity, mood } = field.params;
  t += 0.001 + intensity * 0.004;

  const cx = width / 2;
  const cy = height / 2;

  // densité adaptative
  let targetCount =
    mood === "agitated" ? 700 :
    mood === "dense" ? 520 : 360;

  targetCount = Math.floor(targetCount + intensity * 220);

  // ajuster doucement le nombre de particules
  if (PARTICLES.length < targetCount) {
    PARTICLES.push(new Particle());
  } else if (PARTICLES.length > targetCount) {
    PARTICLES.pop();
  }

  // dessiner le nuage
  for (let p of PARTICLES) {
    p.update(intensity);
    p.draw(cx, cy, bass, mid, high, intensity);
  }
};