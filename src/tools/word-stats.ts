export interface WordStats {
  wordCount: number;
  characterCount: number;
  topWords: { word: string; count: number }[];
}

export function wordStats(text: string, top = 5): WordStats {
  if (!Number.isInteger(top) || top < 1 || top > 20) {
    throw new RangeError("top must be an integer from 1 to 20");
  }

  // Unicode letters/numbers form words; punctuation and whitespace separate them.
  const words = text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);

  return {
    wordCount: words.length,
    characterCount: Array.from(text).length,
    topWords: Array.from(counts, ([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
      .slice(0, top),
  };
}
