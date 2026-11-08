/** Evaluation helpers whose outputs feed PROGRESS.md and the project page (via results.json). */
import { LABELLED_PROGRESSIONS, type LabelledProgression } from "./corpus";
import { findKey, mirexKeyScore } from "./keyfinding";
import { keyShortName, parseKey, sameKey } from "./key";
import { parseProgression } from "./progression";

export interface KeyEvalRow {
  id: string;
  truth: string;
  predicted: string;
  correct: boolean;
  inTop2: boolean;
  ambiguous: boolean;
  confidence: number;
  mirex: number;
  hard: boolean;
}

export interface KeyEvalSummary {
  n: number;
  correct: number;
  accuracy: number;
  top2: number;
  top2Accuracy: number;
  mirexMean: number;
  ambiguousFlagged: number;
  hardN: number;
  hardCorrect: number;
  nonHardN: number;
  nonHardCorrect: number;
  misses: { id: string; truth: string; predicted: string; flaggedAmbiguous: boolean }[];
  missesFlaggedAmbiguous: number;
  rows: KeyEvalRow[];
}

export function evaluateKeyFinding(set: LabelledProgression[] = LABELLED_PROGRESSIONS): KeyEvalSummary {
  const rows: KeyEvalRow[] = set.map((p) => {
    const parsed = parseProgression(p.chords);
    if (parsed.errors.length) throw new Error(`Corpus entry ${p.id} does not parse: ${parsed.errors[0].message}`);
    const truth = parseKey(p.key);
    if (!truth) throw new Error(`Bad key label ${p.key}`);
    const r = findKey(parsed.items);
    return {
      id: p.id,
      truth: keyShortName(truth),
      predicted: keyShortName(r.best),
      correct: sameKey(r.best, truth),
      inTop2: sameKey(r.ranked[0].key, truth) || sameKey(r.ranked[1].key, truth),
      ambiguous: r.ambiguous,
      confidence: r.confidence,
      mirex: mirexKeyScore(r.best, truth),
      hard: !!p.hard,
    };
  });
  const n = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  const top2 = rows.filter((r) => r.inTop2).length;
  const hard = rows.filter((r) => r.hard);
  const nonHard = rows.filter((r) => !r.hard);
  return {
    n,
    correct,
    accuracy: correct / n,
    top2,
    top2Accuracy: top2 / n,
    mirexMean: rows.reduce((s, r) => s + r.mirex, 0) / n,
    ambiguousFlagged: rows.filter((r) => r.ambiguous).length,
    hardN: hard.length,
    hardCorrect: hard.filter((r) => r.correct).length,
    nonHardN: nonHard.length,
    nonHardCorrect: nonHard.filter((r) => r.correct).length,
    misses: rows
      .filter((r) => !r.correct)
      .map((r) => ({ id: r.id, truth: r.truth, predicted: r.predicted, flaggedAmbiguous: r.ambiguous })),
    missesFlaggedAmbiguous: rows.filter((r) => !r.correct && r.ambiguous).length,
    rows,
  };
}

/* ---------------- v2: advanced labelled set ---------------- */

import { ADVANCED_PROGRESSIONS, type AdvancedLabelled } from "./advancedCorpus";
import { analyseFull, deviceTags } from "./harmony";

export interface AdvancedRow {
  id: string;
  match: boolean;
  failures: string[];
}

export interface AdvancedSummary {
  n: number;
  matched: number;
  checks: number;
  checksPassed: number;
  rows: AdvancedRow[];
}

/** Exact match = every expectation of an entry holds (devices, functions, spans, regions). */
export function evaluateAdvanced(set: AdvancedLabelled[] = ADVANCED_PROGRESSIONS): AdvancedSummary {
  let checks = 0, checksPassed = 0;
  const rows = set.map((p) => {
    const parsed = parseProgression(p.chords);
    if (parsed.errors.length) throw new Error(`Advanced entry ${p.id} does not parse`);
    const key = parseKey(p.key)!;
    const a = analyseFull(parsed.items, key);
    const failures: string[] = [];
    const check = (ok: boolean, msg: string) => { checks++; if (ok) checksPassed++; else failures.push(msg); };
    for (const e of p.chordsExpect) {
      const c = a.chords[e.index];
      if (e.device) check(!!c && c.tags.includes(e.device), `#${e.index} device ${e.device} (got ${c?.tags.join("/")})`);
      if (e.fn) check(!!c && c.function === e.fn, `#${e.index} fn ${e.fn} (got ${c?.function})`);
    }
    for (const sp of p.spans ?? []) check(a.spans.some((x) => x.type === sp), `span ${sp}`);
    if (p.regions?.keys) {
      const names = a.regions.regions.map((r) => r.name);
      let k = 0;
      for (const nm of names) if (nm === p.regions.keys[k]) k++;
      check(k === p.regions.keys.length, `regions ${p.regions.keys.join(">")} (got ${names.join(">")})`);
    }
    for (const f of p.regions?.flags ?? []) {
      const tags = deviceTags(a);
      if (f === "no-modulation") check(!tags.has("modulation"), "no-modulation");
      else check(tags.has(f), f);
    }
    return { id: p.id, match: failures.length === 0, failures };
  });
  return { n: rows.length, matched: rows.filter((r) => r.match).length, checks, checksPassed, rows };
}
