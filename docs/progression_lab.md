# Progression Lab

A tension-aware chord-progression analyser, reharmoniser and guitar-voicing optimiser. It runs entirely in the browser: no backend, no API, no paid services. The live page is https://portfolio-site-flax-one-48.vercel.app/work/progression-lab. Its React UI (analyser, library browser and circle-of-fifths view) lives in the portfolio site; this repository contains the engine, its tests and the documentation.

## Architecture

```
src/            pure TypeScript, zero runtime dependencies
  pitch.ts                  pitch classes, note-name parsing, letter-based spelling
  key.ts                    keys, scales, key signatures, key-aware enharmonic spelling
  chord.ts                  chord-symbol parser → root, quality, tones (with roles/optional flags), pcs, bass
  progression.ts            progression text → items with durations (bars, %, newlines)
  keyfinding.ts             Krumhansl–Kessler key finding, confidence, ambiguity flag, MIREX score
  corpus.ts                 52 hand-labelled progressions (evaluation set)
  evaluation.ts             key-finding evaluation summary
  analysis.ts               Roman numerals, functions, non-diatonic categories, cadences
  tension.ts                Lerdahl TPS chord distance and tension curve (see tension_model.md)
  reharm.ts                 beam-search reharmonisation over seven named rules
  voicing.ts                guitar voicing generation, difficulty, Viterbi path, brute force, capo, tab
  audio.ts                  Karplus–Strong synthesis + Web Audio strummer
  __tests__/                vitest suites (7 files)
lib/work.ts                     project card + detail copy (numbers checked by claims.test.ts)
```

Data flow: text → `parseProgression` → `findKey` (or a key the user picks) → `analyseProgression` + `detectCadences` → `tensionCurve` → (user draws a target) → `reharmonise` → `generateVoicings` + `optimiseVoicingPath` → `formatTab` / `StrumPlayer`.

## Algorithms

### Chord parsing
A small recursive-descent parser handles the head (m7b5/ø, dim7/°7, dim/°, aug/+, mMaj7, m/min/-, maj/M/Δ), then the extension (5, 6, 6/9, 7, 9, 11, 13), then the tail (sus2/sus4, add9/add11/add13, b5 #5 b9 #9 #11 b13, alt, no3/no5). The slash bass is the last `/` followed by a complete note name, so `C6/9` is not a slash chord. Each tone carries a role and an `optional` flag: the unaltered 5th is optional, and so are the 9th in 11/13 chords. The canonical quality is derived from the interval structure, not from the spelling the user typed.

### Key finding (Krumhansl 1990)
The Krumhansl–Kessler probe-tone profiles are correlated (Pearson) with a pitch-class histogram. Each chord adds its duration in beats to each of its pitch classes, including the slash bass. The first chord is weighted ×1.25 and the last ×1.5; both weights were fixed before evaluation. The output is all 24 keys ranked. Confidence is the softmax mass of the best key (temperature 0.05); it is not calibrated. The ambiguity flag is set when the top-two margin is < 0.05, or < 0.12 when the runner-up is the relative key.

### Harmonic analysis
Numerals are relative to the key's scale. In minor, the harmonic-minor V and vii° and the melodic-minor tonic count as diatonic. The classification order is: diatonic → Dorian IV (minor) → secondary dominant → secondary leading-tone → tritone substitute (must resolve) → Neapolitan → borrowed from the parallel mode → blues dominant → chromatic/unclassified. Functions: T / PD / D / ?. Cadences: authentic, plagal, deceptive anywhere; half at the end.

### Tension (Lerdahl 2001)
δ = i (region) + j (chordal circle of fifths) + k (basic-space non-common tones). Tension(n) = δ(tonic, n) + 0.5·δ(n−1, n) + a surface-dissonance term. Every simplification is listed in `docs/tension_model.md`.

### Reharmonisation
Beam search (width 48) runs right-to-left over the original chord slots, so rules aimed at the following chord see the real successor. Each slot either keeps its chord or is replaced by one or two chords of the same total duration. The rules are: diatonic function substitute, secondary dominant, ii–V insertion, tritone substitution, modal-mixture borrowing, passing diminished, and deceptive resolution.

Score = RMS(slot tension − target) + 0.5·mean voice-leading + 0.5·changes. Suggestions are dropped if they are farther from the target than the original, if they change nothing, or if they create an immediate repeat. Each change records its rule(s) and a sentence explaining it.

### Voicings and path (dynamic programming)
Voicings are enumerated in 4-fret windows (frets 0–15) in standard tuning, subject to:
- at least 3 strings and at most 4 fingers (barre-aware);
- at most one muted string inside the voicing;
- the bass (slash or root) on string 6, 5 or 4;
- every required tone present.

A hand-set difficulty heuristic ranks the voicings, and the 24 easiest per chord are kept. The Viterbi path minimises difficulty + 0.6·|Δposition| + 0.4·(voice-leading in semitones). `bruteForceVoicingPath` verifies the optimum on small cases.

### Synthesis (Karplus & Strong 1983)
A delay line holds a seeded, low-passed noise burst and feeds back through a two-point average and a first-order all-pass. The all-pass supplies the fractional delay, which keeps each string in tune. The strum plays low to high, 18 ms between strings, and each chord is damped at the next chord change.

## Test inventory (`npm test`)

| file | tests | what it checks |
|------|-------|----------------|
| chord.test.ts | 33 | all required qualities → exact pitch classes; alternative spellings; 6/9 vs slash; enharmonics; rejects junk; optional 5th; key-aware spelling; transposition; progression parsing |
| keyfinding.test.ts | 9 | ranking of all 24 keys; textbook keys; relative-key ambiguity flag; transposition equivariance on all 52 × 11 transpositions; MIREX scoring; corpus validity; accuracy report |
| analysis.test.ts | 12 | diatonic and minor-key numerals; inversion figures; secondary dominants / leading-tone chords; borrowed; tritone subs; Neapolitan; blues; functions; cadences; transposition invariance with given key and with detected key (52 × 12) |
| tension.test.ts | 14 | Lerdahl's published δ values (I→V, IV, ii, vi, iii); symmetry; region distance; circle-of-fifths helpers; k; tonic minimal; V7 > V > I; resolutions lower tension; chromatic > diatonic; transposition invariance (52 × 11) |
| reharm.test.ts | 8 | expected moves (V7/V, passing dim, deceptive); every change names its rules; empty-result message; 260-case property run (locks, parse-back, durations, never worse than original); locks under heavy change; voice-leading metric |
| voicing.test.ts | 13 | standard open shapes ranked first; barre F; slash basses; every voicing of every corpus chord valid; omitted 5th allowed; bassFree; DP = brute force on 52 cases; chosen voicings contain required tones; position economy; capo; tab format; synth determinism, decay, tuning |
| claims.test.ts | 3 | the project page's numbers equal freshly computed results |

## Results (all produced by the tests)

- Key finding: **47/52 exact (90.4%)**, correct key in top 2 for 52/52, MIREX-weighted 0.919. 41/43 on non-hard entries, 6/9 on hard entries. Three of the five misses were flagged ambiguous.
- Voicing path: DP equals brute force on **52/52** small cases (4 chords × 6 voicings).
- Reharmoniser: **260** property cases, 0 violations; 233 produced at least one suggestion.
- Synth: every open string is within 0.5% of its target pitch (autocorrelation).
- 92 tests in 7 files.

## Limits

- Western tonal harmony only; no melody, lyrics or audio input.
- The tension model is a simplified TPS (no prolongational tree; heuristic surface weights; chromatic chords stay in the home region).
- Suggestions come from seven fixed rules and a hand-weighted score. They are not taste and not genre-aware.
- The labelled set is small and self-labelled, so its accuracy says little about real repertoire. Confidence is not calibrated.
- Voicing difficulty is a heuristic. Only standard tuning is supported; the voicing search does not model alternate tunings or capo-specific shapes (the capo helper transposes shapes).
- Half cadences are detected only at the end, because phrase boundaries are unknown.

## References

- C. L. Krumhansl, *Cognitive Foundations of Musical Pitch*, Oxford University Press, 1990. (Key profiles from Krumhansl & Kessler, 1982.)
- F. Lerdahl, *Tonal Pitch Space*, Oxford University Press, 2001.
- K. Karplus & A. Strong, "Digital Synthesis of Plucked-String and Drum Timbres", *Computer Music Journal* 7(2), 1983.
- D. A. Jaffe & J. O. Smith, "Extensions of the Karplus-Strong Plucked-String Algorithm", *Computer Music Journal* 7(2), 1983 (all-pass tuning).

---

# v2 — advanced harmony, named-progression library, no "?" functions

## New and changed modules

```
src/
  analysis.ts        rewritten: T/PD/D/PASS, inferred fallback, devices, chips, tags, reasons, explanations, alternatives
  structure.ts       spans: pedal, line cliché, lament / descending bass, Mixolydian & Dorian vamps, Coltrane cycle
  regions.ts         sliding-window KK + cadence bonus + Viterbi key regions, tonicisation vs modulation, pivots
  harmony.ts         analyseFull(): chords + local readings + cadences + spans + regions; deviceTags()
  advancedCorpus.ts  44 hand-labelled progressions with expected devices/functions/spans/regions (committed first)
  library.ts         35 named progressions, ≤ 2 web-verified song examples each (title + artist + sources)
  reharm.ts          + optional rules: augmented-sixth approach, Neapolitan approach, backdoor ii–V, chromatic mediant
docs/library_sources.md             verification log for song examples
```

## Algorithms (v2)

- **Function system.** Classification runs on the chord core (root, 3rd/sus, 5th, 7th), so extensions and alterations never change the function. The order is: symmetric chords → augmented sixth → diatonic → Dorian IV → secondary dominant → secondary leading-tone → tritone substitute → Neapolitan/Phrygian bII → backdoor → blues dominant → modal interchange (source mode named) → chromatic mediant → inferred from the root degree.
- **Symmetric chords.**
  - Augmented triads: reading as V+ (the chord falls a fifth to the next chord), passing I+ (a #5 between two chords on the same root) or III+ in minor.
  - Diminished sevenths: common-tone (contains the root of the chord it decorates), leading-tone vii°7/x (a candidate root rises a half step), or descending passing.
- **Augmented sixths.** Recognised from pitch content relative to the tonic (It {b6,1,#4}, Fr {b6,1,2,#4}, Ger {b6,1,b3,#4}) *and* resolution to V or the cadential I6/4. Pop spellings are covered, e.g. Ab7 → G (Ger+6) and D7b5/Ab (Fr+6).
- **Key regions.**
  - Evidence: KK correlation over a 5-chord window, plus a bonus for each V(7)→I arrival.
  - Smoothing: Viterbi over 24 keys with a switch penalty, starting in the home key.
  - Labels: non-home regions of 3 or more chords are modulations, shorter ones tonicisations.
  - Pivot: the latest chord before a modulation that is diatonic in both keys.

## Test inventory (v2 additions)

| file | tests | what it checks |
|------|-------|----------------|
| advanced.test.ts | 23 | never-unknown functions on both labelled sets; inferred fallback; 1–2 sentence explanations; every device family (symmetric chords, aug6 incl. pop spellings, N6/Phrygian, ct°7/passing dim, mediants vs mixture vs applied, modal sources, extensions/altered/sus, backdoor); spans; regions (Coltrane B→G→Eb→B, C→G modulation with pivot Am = vi/ii, no false modulations); region and full-analysis transposition invariance; advanced-set score |
| library.test.ts | 40 | ids/featured/fields; every entry parses and contains its expected devices; no unknown function; every shown example sourced; ≤ 2 examples per entry; dropped/trimmed bookkeeping |
| reharm-advanced.test.ts | 6 | each advanced rule generated, explained and analysed as its device; off by default; property run with rules on |
| claims.test.ts | 5 | page numbers = computed numbers (52-set, advanced set, library counts, DP, reharm runs) |

Total: **163 tests** in 10 files.

## Results (v2, from tests)

- 52-set key finding unchanged: 47/52 (90.4%), top-2 52/52, MIREX 0.919.
- Advanced set: **44/44** exact match, 103/103 checks. This is not blind: one general fix found while implementing (the region DP starts in the home key) also fixed the Coltrane entry. See PROGRESS.md.
- Library: 35 entries. 55/56 seed song examples verified against web sources, 1 dropped; 38 shown (≤ 2 per entry).
- DP = brute force 52/52; reharm property run 260 cases, 0 violations (advanced rules off), plus a separate run over the 52-set and the library with the rules on.

## v2 limits

- Western tonal and jazz harmony only. Labels are rule-based, and where readings compete (Ger+6 vs subV7/V, bVI as mixture vs mediant) one fixed rule picks the label and the others are listed as alternatives.
- Region parameters (window, bonus, penalty) are hand-set on synthetic cases. Short progressions give little evidence, and regions shorter than 3 chords are reported as tonicisations.
- Song examples are verified but not exhaustive, and a song may use the progression in only one section or another key.
