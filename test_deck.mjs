import assert from "node:assert/strict";
import test from "node:test";
import { Deck, VocabularyItem, parseTsv } from "./deck.mjs";

const item = (name) => new VocabularyItem([name, name.toUpperCase()], `${name}\t${name.toUpperCase()}`);

test("rating and end scheduling stay within the active range", () => {
  const deck = new Deck(Array.from({ length: 11 }, (_, index) => item(String(index))));
  deck.takeNext();
  deck.scheduleActive(5);
  assert.equal(deck.items[5].value(0), "0");
  deck.takeNext();
  deck.scheduleActive();
  assert.equal(deck.items.at(-1).value(0), "1");
});

test("ejection and reset preserve every item", () => {
  const deck = new Deck([item("a"), item("b"), item("c")]);
  deck.takeNext();
  deck.ejectActive();
  assert.deepEqual(deck.snapshot().map((value) => value.value(0)), ["b", "c", "a"]);
  deck.resetRange();
  assert.equal(deck.activeCount, 3);
  assert.equal(deck.ejected.length, 0);
});

test("range reassembles around prefix and suffix", () => {
  const deck = new Deck([item("1"), item("2"), item("3"), item("4")]);
  deck.setRange(2, 3);
  deck.takeNext();
  deck.scheduleActive();
  assert.deepEqual(deck.orderedItems().map((value) => value.value(0)), ["1", "3", "2", "4"]);
});

test("serialization restores practice state", () => {
  const deck = new Deck([item("a"), item("b")]);
  deck.takeNext();
  const restored = Deck.fromJSON(JSON.parse(JSON.stringify(deck)));
  assert.equal(restored.active.value(0), "a");
  assert.equal(restored.totalCount, 2);
});

test("TSV parsing supports BOM, header, blank rows, and variable width", () => {
  const result = parseTsv("\uFEFFWord\tMeaning\r\nisa\tone\r\n\r\ndalawa\ttwo\tnote\r\n", true);
  assert.equal(result.header, "Word\tMeaning");
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.items[1].fields, ["dalawa", "two", "note"]);
});
