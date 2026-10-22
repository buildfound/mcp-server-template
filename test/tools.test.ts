import assert from "node:assert/strict";
import { test } from "node:test";
import { add } from "../src/tools/add.js";
import { wordStats } from "../src/tools/word-stats.js";

test("add handles positive, negative and fractional numbers", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-2, 2), 0);
  assert.equal(add(0.25, 0.5), 0.75);
});

test("wordStats counts and ranks words with deterministic ties", () => {
  assert.deepEqual(wordStats("Pear, apple! PEAR banana apple.", 2), {
    wordCount: 5,
    characterCount: 31,
    topWords: [{ word: "apple", count: 2 }, { word: "pear", count: 2 }],
  });
});

test("wordStats handles empty text, Unicode and punctuation", () => {
  assert.deepEqual(wordStats(""), { wordCount: 0, characterCount: 0, topWords: [] });
  assert.deepEqual(wordStats("Café CAFE\u0301 😊 42"), {
    wordCount: 3,
    characterCount: 15,
    topWords: [{ word: "café", count: 2 }, { word: "42", count: 1 }],
  });
  assert.equal(wordStats("--- 😊").wordCount, 0);
  assert.equal(wordStats("one two three four five six").topWords.length, 5);
});

test("wordStats enforces the top range", () => {
  for (const top of [0, 21, 1.5, NaN]) {
    assert.throws(() => wordStats("hello", top), RangeError);
  }
  assert.equal(wordStats("hello", 1).topWords.length, 1);
  assert.equal(wordStats("hello", 20).topWords.length, 1);
});
