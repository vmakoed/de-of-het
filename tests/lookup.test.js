const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseWords, lookup, suggest } = require("../public/lookup.js");

const index = parseWords(fs.readFileSync(path.join(__dirname, "..", "public", "words.txt"), "utf8"));

const cases = [
  ["huis", ["het"], "Zeker"],
  ["fiets", ["de"], "Zeker"],
  ["meisje", ["het"], "Zeker"],
  ["boeken", ["de"], "Meervoud"],
  ["auto's", ["de"], "Meervoud"],
  ["auto’s", ["de"], "Meervoud"],
  ["voetbalveld", ["het"], null],
  ["vergadertafel", ["de"], null],
  ["oefenvoetbalveld", ["het"], "Samengesteld woord"],
  ["kantoorvergadertafel", ["de"], "Samengesteld woord"],
  ["voetbalvelden", ["de"], "Meervoud"],
  ["drop", ["de", "het"], "Zeker"],
  ["gezondheid", ["de"], null],
  ["  Huis ", ["het"], "Zeker"],
  ["het huis", ["het"], "Zeker"],
  ["xqzt", [], "Onbekend"],
];

for (const [input, articles, label] of cases) {
  test(`lookup ${JSON.stringify(input)}`, () => {
    const r = lookup(index, input);
    assert.deepEqual(r.articles, articles);
    if (label) assert.equal(r.label, label);
  });
}

test("plural reason names the singular", () => {
  assert.match(lookup(index, "huizen").reason, /enkelvoud: het huis/);
});

test("compound reason names the head", () => {
  assert.match(lookup(index, "oefenvoetbalveld").reason, /het voetbalveld/);
});

test("plural fallback undoes doubled consonant", () => {
  const trimmed = parseWords(fs.readFileSync(path.join(__dirname, "..", "public", "words.txt"), "utf8"));
  trimmed.map.delete("tassen");
  const r = lookup(trimmed, "tassen");
  assert.deepEqual(r.articles, ["de"]);
  assert.equal(r.label, "Meervoud");
  assert.match(r.reason, /de tas\)/);
});

test("diminutive rule", () => {
  const r = lookup(index, "flurbje");
  assert.deepEqual(r.articles, ["het"]);
  assert.equal(r.label, "Volgens de regel");
});

test("suffix rule", () => {
  assert.deepEqual(lookup(index, "qwrtzheid").articles, ["de"]);
  assert.deepEqual(lookup(index, "qwrtzisme").articles, ["het"]);
});

test("empty input", () => {
  assert.equal(lookup(index, "   "), null);
});

test("suggestions are prefix matches, max 4, no exact match", () => {
  const s = suggest(index, "fie");
  assert.ok(s.length > 0 && s.length <= 4);
  for (const x of s) assert.ok(x.word.startsWith("fie") && x.word !== "fie");
  assert.ok(!suggest(index, "huis").some((x) => x.word === "huis"));
});
