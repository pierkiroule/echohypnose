export const field = {
  state: null,
  params: {
    intensity: 0,
    mood: "calm", // calm | dense | agitated
    echoCount: 0
  }
};

export function setFieldState(s) {
  field.state = s;

  const intensity = typeof s.intensity === "number" ? s.intensity : 0;
  const echoCount = typeof s.echoCount === "number" ? s.echoCount : 0;

  let mood = "calm";
  if (intensity > 0.66) mood = "agitated";
  else if (intensity > 0.33) mood = "dense";

  field.params = { intensity, mood, echoCount };
}
