(function () {
  "use strict";

  const { parseWords, normalize, lookup, suggest } = window.DeOfHet;

  const $ = (id) => document.getElementById(id);
  const input = $("q");
  const clearBtn = $("clear");
  const loading = $("loading");
  const resultEl = $("result");
  const badgesEl = $("badges");
  const phraseEl = $("phrase");
  const labelEl = $("label");
  const reasonEl = $("reason");
  const unknownEl = $("unknown");
  const unknownWord = $("unknown-word");
  const suggestionsEl = $("suggestions");
  const suggestionList = $("suggestion-list");
  const examplesEl = $("examples");

  let index = null;

  function badge(article) {
    const el = document.createElement("div");
    el.className = "badge badge--" + article;
    el.textContent = article;
    return el;
  }

  function renderResult(r) {
    badgesEl.replaceChildren(...r.articles.map(badge));
    badgesEl.classList.toggle("badges--both", r.articles.length > 1);
    phraseEl.textContent = r.articles.join("/") + " " + r.word;
    phraseEl.classList.toggle("result__phrase--long", r.word.length > 13);
    labelEl.textContent = r.label;
    reasonEl.textContent = r.reason;
  }

  function renderSuggestions(items) {
    suggestionList.replaceChildren(
      ...items.map((s) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "row";
        btn.dataset.word = s.word;
        const word = document.createElement("span");
        word.textContent = s.word;
        const art = document.createElement("span");
        const label = s.articles.join("/");
        art.className = "row__article" + (label === "het" ? " row__article--het" : "");
        art.textContent = label;
        btn.append(word, art);
        li.append(btn);
        return li;
      })
    );
  }

  function update() {
    const raw = input.value;
    const w = normalize(raw);
    clearBtn.hidden = raw.length === 0;
    examplesEl.hidden = w.length > 0;

    if (!index) {
      loading.hidden = w.length === 0;
      resultEl.hidden = unknownEl.hidden = suggestionsEl.hidden = true;
      return;
    }
    loading.hidden = true;

    const r = w ? lookup(index, raw) : null;
    const found = !!r && r.articles.length > 0;
    const isExact = index.map.has(w);
    const suggestions = w && !isExact ? suggest(index, raw, 4) : [];

    resultEl.hidden = !found;
    if (found) renderResult(r);

    unknownEl.hidden = !(r && !found && suggestions.length === 0);
    if (!unknownEl.hidden) unknownWord.textContent = r.word;

    suggestionsEl.hidden = suggestions.length === 0;
    renderSuggestions(suggestions);
  }

  function fill(word) {
    input.value = word;
    update();
    input.focus();
  }

  input.addEventListener("input", update);

  clearBtn.addEventListener("click", () => fill(""));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-word]");
    if (btn) fill(btn.dataset.word);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });

  async function load() {
    update();
    try {
      const res = await fetch("words.txt");
      if (!res.ok) throw new Error(res.status);
      index = parseWords(await res.text());
    } catch (err) {
      loading.textContent = "De woordenlijst kon niet worden geladen. Controleer je verbinding en probeer het opnieuw.";
      loading.hidden = false;
      return;
    }
    update();
  }

  load();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
