(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeOfHet = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DE_SUFFIXES = ["heid", "ing", "nis", "tie", "sie", "teit", "schap", "ij", "erij", "ster", "ade", "ide", "ode", "ude", "ure", "ine", "iek"];
  const HET_SUFFIXES = ["isme", "ment", "sel", "um"];
  const DIMINUTIVE = /(je|tje|pje|kje|etje)$/;

  function parseWords(text) {
    const map = new Map();
    const sorted = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      const [word, code, base] = line.split("\t");
      map.set(word, { code, base });
      sorted.push(word);
    }
    return { map, sorted };
  }

  function normalize(raw) {
    let w = String(raw || "")
      .normalize("NFC")
      .replace(/[‘’ʼ`]/g, "'")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    w = w.replace(/^(de|het) (?=\S)/, "");
    return w;
  }

  function articlesFor(code) {
    if (code === "h") return ["het"];
    if (code === "b") return ["de", "het"];
    return ["de"];
  }

  function withArticle(code, word) {
    return articlesFor(code).join("/") + " " + word;
  }

  function lemmaEntry(index, word) {
    const e = index.map.get(word);
    return e && e.code !== "p" ? e : null;
  }

  function result(word, code, label, reason, extra) {
    return Object.assign({ word, articles: articlesFor(code), label, reason }, extra);
  }

  function pluralResult(word, base, baseCode) {
    return result(word, "d", "Meervoud", "Meervouden zijn altijd de-woorden (enkelvoud: " + withArticle(baseCode, base) + ").", { base });
  }

  function exact(index, w) {
    const e = index.map.get(w);
    if (!e) return null;
    if (e.code === "h") return result(w, "h", "Zeker", "Dit is een het-woord. Verkleinwoord? Ook het.");
    if (e.code === "d") return result(w, "d", "Zeker", "Dit is een de-woord. Het meervoud is ook altijd de.");
    if (e.code === "b") return result(w, "b", "Zeker", "Allebei komt voor. Let op: soms verschilt de betekenis per lidwoord.");
    const base = lemmaEntry(index, e.base);
    return pluralResult(w, e.base, base ? base.code : "d");
  }

  function pluralStems(w) {
    const stems = [];
    if (w.endsWith("'s")) stems.push(w.slice(0, -2));
    if (w.endsWith("s")) stems.push(w.slice(0, -1));
    if (w.endsWith("en")) {
      const b = w.slice(0, -2);
      stems.push(b);
      if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) stems.push(b.slice(0, -1));
    }
    return stems.filter((s) => s.length >= 2);
  }

  function pluralFallback(index, w) {
    for (const stem of pluralStems(w)) {
      const e = lemmaEntry(index, stem);
      if (e) return pluralResult(w, stem, e.code);
    }
    return null;
  }

  function diminutiveRule(w) {
    if (w.length > 4 && DIMINUTIVE.test(w)) {
      return result(w, "h", "Volgens de regel", "Verkleinwoorden (op -je, -tje, -pje, -kje) zijn altijd het-woorden.");
    }
    return null;
  }

  function compoundRule(index, w) {
    for (let i = 2; i <= w.length - 3; i++) {
      const head = w.slice(i);
      const e = index.map.get(head);
      if (!e) continue;
      const prefix = w.slice(0, i);
      if (e.code === "p") {
        const base = lemmaEntry(index, e.base);
        return pluralResult(w, prefix + e.base, base ? base.code : "d");
      }
      return result(w, e.code, "Samengesteld woord", "Het laatste deel bepaalt het lidwoord: " + withArticle(e.code, head) + ".", { head });
    }
    return null;
  }

  function suffixRule(w) {
    if (w.length <= 4) return null;
    if (HET_SUFFIXES.some((s) => w.endsWith(s))) {
      return result(w, "h", "Volgens de regel", "Woorden op -isme, -ment, -sel en -um zijn meestal het-woorden.");
    }
    const de = DE_SUFFIXES.find((s) => w.endsWith(s));
    if (de) return result(w, "d", "Volgens de regel", "Woorden op -" + de + " zijn meestal de-woorden.");
    return null;
  }

  function lookup(index, raw) {
    const w = normalize(raw);
    if (!w) return null;
    if (w.includes(" ")) return { word: w, articles: [], label: "Onbekend", reason: "" };
    return (
      exact(index, w) ||
      pluralFallback(index, w) ||
      diminutiveRule(w) ||
      compoundRule(index, w) ||
      suffixRule(w) || { word: w, articles: [], label: "Onbekend", reason: "" }
    );
  }

  function lowerBound(arr, key) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function suggest(index, raw, limit) {
    const q = normalize(raw);
    const max = limit || 4;
    if (!q) return [];
    const lemmas = [];
    const plurals = [];
    for (let i = lowerBound(index.sorted, q), seen = 0; i < index.sorted.length && seen < 400; i++, seen++) {
      const word = index.sorted[i];
      if (!word.startsWith(q)) break;
      if (word === q) continue;
      const code = index.map.get(word).code;
      (code === "p" ? plurals : lemmas).push({ word, articles: articlesFor(code) });
      if (lemmas.length >= max) break;
    }
    return lemmas.concat(plurals).slice(0, max);
  }

  return { parseWords, normalize, lookup, suggest, articlesFor };
});
