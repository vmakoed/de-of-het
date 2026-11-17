#!/usr/bin/env python3
"""Build public/words.txt from Kaikki.org's Dutch Wiktionary extract.

Usage: python3 scripts/build_words.py [--refresh]

Output: one entry per line, tab-separated, sorted by code point:
    word<TAB>code[<TAB>singular]
codes: h = het, d = de, b = de and het, p = plural (de), with its singular.
"""

import argparse
import json
import sys
import unicodedata
import urllib.request
from collections import Counter
from pathlib import Path

URL = "https://kaikki.org/dictionary/Dutch/kaikki.org-dictionary-Dutch.jsonl"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "kaikki-dutch.jsonl"
OUT = ROOT / "public" / "words.txt"

GENDER_LETTERS = {"n": "n", "m": "c", "f": "c", "c": "c"}
GENDER_TAGS = {"neuter": "n", "masculine": "c", "feminine": "c", "common": "c"}
ABBREV_TAGS = {"abbreviation", "initialism", "acronym"}
WEAK_TAGS = {"obsolete", "archaic", "dialectal", "rare", "alt-of", "misspelling", "dated"}


def download(refresh):
    if CACHE.exists() and not refresh:
        return
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE.with_suffix(".part")
    print(f"Downloading {URL} ...", file=sys.stderr)
    with urllib.request.urlopen(URL) as resp, open(tmp, "wb") as out:
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    tmp.rename(CACHE)


def normalize(word):
    w = unicodedata.normalize("NFC", word).lower()
    if not w or " " in w:
        return None
    if not all(ch.isalpha() or ch in "-'" for ch in w):
        return None
    if not any(ch.isalpha() for ch in w):
        return None
    return w


def sense_tags(entry):
    return [set(s.get("tags", [])) for s in entry.get("senses", [])] or [set()]


def genders_of(entry):
    found = set()
    for head in entry.get("head_templates", []):
        name = head.get("name", "")
        if name.startswith("nl-noun-dim"):
            found.add("n")
        elif name == "nl-noun":
            arg = head.get("args", {}).get("1", "") or ""
            for part in arg.replace("/", ",").split(","):
                part = part.strip()
                if part == "p":
                    found.add("c")
                elif part in ("mf",):
                    found.add("c")
                else:
                    found.update(GENDER_LETTERS[ch] for ch in part if ch in GENDER_LETTERS and len(part) == 1)
    if not found:
        tags = set(entry.get("tags", []) or [])
        for st in sense_tags(entry):
            tags |= st
        found.update(GENDER_TAGS[t] for t in tags if t in GENDER_TAGS)
    return found


def is_abbreviation(entry, raw_word):
    if len(raw_word) > 1 and raw_word.isupper():
        return True
    return all(st & ABBREV_TAGS for st in sense_tags(entry))


def is_weak(entry):
    return all(st & WEAK_TAGS for st in sense_tags(entry))


def plural_lemma(entry):
    for s in entry.get("senses", []):
        tags = set(s.get("tags", []))
        if "plural" in tags and "form-of" in tags and "diminutive" not in tags:
            for f in s.get("form_of", []):
                base = normalize(f.get("word", ""))
                if base:
                    return base
    return None


def article_code(genders):
    if genders == {"n"}:
        return "h"
    if genders == {"c"}:
        return "d"
    return "b"


def build():
    strong = {}
    weak = {}
    plurals = {}
    diminutives = set()
    stats = Counter()

    with open(CACHE, encoding="utf-8") as fh:
        for line in fh:
            entry = json.loads(line)
            if entry.get("lang_code") != "nl" or entry.get("pos") != "noun":
                continue
            raw = entry.get("word", "")
            word = normalize(raw)
            if not word:
                stats["skipped_chars_or_space"] += 1
                continue
            if is_abbreviation(entry, raw):
                stats["skipped_abbreviation"] += 1
                continue

            base = plural_lemma(entry)
            genders = genders_of(entry)
            if base and not genders:
                plurals.setdefault(word, base)
                stats["plural_entries"] += 1
                continue
            if not genders:
                stats["no_gender"] += 1
                continue

            bucket = weak if is_weak(entry) else strong
            bucket.setdefault(word, set()).update(genders)

            for form in entry.get("forms", []):
                tags = set(form.get("tags", []))
                fw = normalize(form.get("form", ""))
                if not fw or tags & {"alternative", "obsolete", "archaic", "dialectal"}:
                    continue
                if "plural" in tags and "diminutive" not in tags:
                    plurals.setdefault(fw, word)
                elif "diminutive" in tags and "plural" not in tags:
                    diminutives.add(fw)

    lemmas = dict(weak)
    lemmas.update(strong)

    rows = {w: (article_code(g),) for w, g in lemmas.items()}
    for w in diminutives:
        rows.setdefault(w, ("h",))
    for w, base in plurals.items():
        if w not in rows and base in lemmas:
            rows[w] = ("p", base)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as out:
        for w in sorted(rows):
            out.write("\t".join((w, *rows[w])) + "\n")

    codes = Counter(r[0] for r in rows.values())
    print(f"nouns without gender info (skipped): {stats['no_gender']}")
    print(f"skipped abbreviations: {stats['skipped_abbreviation']}, bad chars/multi-word: {stats['skipped_chars_or_space']}")
    print(f"lemmas: {len(lemmas)} (weak-only: {len(set(weak) - set(strong))})")
    print(f"total lines: {len(rows)}")
    for code in "hdbp":
        print(f"  {code}: {codes[code]}")
    print(f"size: {OUT.stat().st_size / 1024 / 1024:.2f} MB ({OUT.stat().st_size} bytes)")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="re-download the Kaikki data")
    args = parser.parse_args()
    download(args.refresh)
    build()


if __name__ == "__main__":
    main()
