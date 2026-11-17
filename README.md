# De of het?

A tiny offline web app that tells you whether a Dutch noun takes **de** or **het**.
The answer updates as you type. After the first visit it works without a network and
can be installed to the home screen (iOS Safari: Share → Zet op beginscherm; Android
Chrome: Install app).

Plain HTML, CSS and JavaScript in `public/`. No framework, no build step, no runtime
dependencies, no analytics.

## How it decides

`public/lookup.js` holds the logic (pure functions, shared by the app and the tests):

1. **Exact match** in the word list → "Zeker". Plurals in the list → de, "Meervoud".
2. **Plural fallback**: strip `'s`, `s`, `en` (and a doubled consonant, *tassen* → *tas*);
   if the stem is a known noun → de, "Meervoud".
3. **Diminutive rule**: ends in `-je`/`-tje`/`-pje`/`-kje`/`-etje` → het.
4. **Compound rule**: the longest known noun at the end of the word decides
   (*oefenvoetbalveld* → het voetbalveld).
5. **Suffix rules**: `-heid`, `-ing`, `-teit`, … → de; `-isme`, `-ment`, `-sel`, `-um` → het.
6. Otherwise: "Nog niet gevonden". The app never guesses silently.

## Rebuild the word list

```bash
python3 scripts/build_words.py
```

Downloads the Dutch Wiktionary extract from Kaikki.org (~250 MB, cached in
`scripts/.cache/`, gitignored), filters nouns and writes `public/words.txt`. Add
`--refresh` to download a fresh copy. Python 3 standard library only.

`words.txt` format: one entry per line, tab-separated, sorted by code point.

```
huis	h
huizen	p	huis
fiets	d
drop	b
```

`h` = het, `d` = de, `b` = both (meaning can differ), `p` = plural (always de), with its
singular in the third column.

After rebuilding, bump `VERSION` in `public/sw.js` so installed apps pick up the new list.

## Run locally

```bash
python3 -m http.server -d public 8000
```

Open http://localhost:8000. The service worker works on `localhost` without HTTPS.

## Tests

```bash
node --test
```

Runs the lookup tests against the real `words.txt` (Node 18+, no packages).

## Offline and updates

`public/sw.js` precaches every app file, including `words.txt`, into a cache named
`de-of-het-<VERSION>` and serves cache-first. **Bump `VERSION` in `public/sw.js`
whenever any file in `public/` changes**, otherwise installed copies keep the old files.
Old caches are deleted when the new worker activates.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests and deploys `public/` on every push to `main`.
All paths are relative, so the app works from a sub-path like
`https://<user>.github.io/de-of-het/`.

One-time setup:

1. Create an empty repository on GitHub (e.g. `de-of-het`).
2. `git remote add origin git@github.com:<user>/de-of-het.git`
3. `git push -u origin main`
4. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Re-run the workflow (Actions tab) if the first run happened before step 4.

## Data license

The word list comes from Wiktionary via Kaikki.org and is licensed CC BY-SA 4.0.
See [LICENSE-DATA.md](LICENSE-DATA.md).
