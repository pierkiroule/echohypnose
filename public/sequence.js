// Séquence échohypnotique utilisateur
// 3 emojis max, ordre conservé

export const sequence = [];

export function toggleEmoji(emoji) {
  const i = sequence.indexOf(emoji);

  if (i !== -1) {
    sequence.splice(i, 1);
    return;
  }

  if (sequence.length < 3) {
    sequence.push(emoji);
  }
}

export function resetSequence() {
  sequence.length = 0;
}
