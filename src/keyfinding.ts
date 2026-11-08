/**
 * Key finding with Krumhansl–Kessler probe-tone profiles (Krumhansl 1990, Cognitive Foundations of
 * Musical Pitch; profiles from Krumhansl & Kessler 1982), correlated (Pearson) with a duration-weighted
 * pitch-class histogram of the chord tones (the Krumhansl–Schmuckler method applied to chord symbols).
 */
import { ALL_KEYS, keyName, parallelKey, relativeKey, sameKey, signatureFifths, type Key } from "./key";
import { mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";

export const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Fixed a priori (not tuned on the labelled set): extra weight for the first and last chords. */
export const FIRST_CHORD_WEIGHT = 1.25;
export const LAST_CHORD_WEIGHT = 1.5;
/** Top-two correlation margin below which the result is flagged ambiguous. */
export const AMBIGUITY_MARGIN = 0.05;
/**
 * Relative major/minor share every diatonic tone, so chord-tone histograms separate them by only ~0.1.
 * Set from synthetic cases that are ambiguous by construction (e.g. "Am C Am C", margin 0.11), not from
 * the labelled set. Only affects the ambiguity flag, never the ranking or accuracy.
 */
export const RELATIVE_AMBIGUITY_MARGIN = 0.12;
/** Softmax temperature used to turn correlations into a confidence value (not a calibrated probability). */
export const CONFIDENCE_TEMPERATURE = 0.05;

export interface KeyScore {
  key: Key;
  name: string;
  score: number; // Pearson correlation, -1..1
}

export type KeyRelation = "relative" | "parallel" | "dominant" | "subdominant" | "other";

export interface KeyResult {
  ranked: KeyScore[]; // all 24 keys, best first
  best: Key;
  confidence: number; // 0..1, softmax mass of the best key
  margin: number; // score(best) - score(second)
  ambiguous: boolean;
  /** When ambiguous: how the runner-up relates to the best key. */
  alternative?: { key: Key; name: string; relation: KeyRelation };
  histogram: number[];
}

export function pitchHistogram(items: ProgressionItem[]): number[] {
  const h = new Array(12).fill(0);
  items.forEach((it, i) => {
    let w = it.duration;
    if (i === 0) w *= FIRST_CHORD_WEIGHT;
    if (i === items.length - 1) w *= LAST_CHORD_WEIGHT;
    const pcs = new Set(it.chord.pcs);
    pcs.add(it.chord.bass);
    for (const pc of pcs) h[pc] += w;
  });
  return h;
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

export function keyRelation(a: Key, b: Key): KeyRelation {
  if (sameKey(relativeKey(a), b)) return "relative";
  if (sameKey(parallelKey(a), b)) return "parallel";
  if (a.mode === b.mode && mod12(b.tonic - a.tonic) === 7) return "dominant";
  if (a.mode === b.mode && mod12(b.tonic - a.tonic) === 5) return "subdominant";
  return "other";
}

/** Score all 24 keys for a histogram. Scores are rounded to 1e-9 so that transposed inputs rank identically. */
export function scoreKeys(hist: number[]): KeyScore[] {
  const scores = ALL_KEYS.map((key) => {
    const profile = key.mode === "major" ? KK_MAJOR : KK_MINOR;
    const rotated = hist.map((_, pc) => profile[mod12(pc - key.tonic)]);
    return { key, name: keyName(key), score: Math.round(pearson(hist, rotated) * 1e9) / 1e9 };
  });
  return scores.sort((x, y) => y.score - x.score || tieBreak(x.key) - tieBreak(y.key));
}

/** Deterministic tie-break: prefer major, then fewer accidentals. */
function tieBreak(k: Key): number {
  return (k.mode === "major" ? 0 : 100) + Math.abs(signatureFifths(k));
}

export function findKey(items: ProgressionItem[]): KeyResult {
  const histogram = pitchHistogram(items);
  const ranked = scoreKeys(histogram);
  const [first, second] = ranked;
  const z = ranked.map((r) => Math.exp((r.score - first.score) / CONFIDENCE_TEMPERATURE));
  const confidence = 1 / z.reduce((s, v) => s + v, 0);
  const margin = first.score - second.score;
  const relation = keyRelation(first.key, second.key);
  const ambiguous = margin < AMBIGUITY_MARGIN || (relation === "relative" && margin < RELATIVE_AMBIGUITY_MARGIN);
  return {
    ranked,
    best: first.key,
    confidence,
    margin,
    ambiguous,
    alternative: ambiguous
      ? { key: second.key, name: second.name, relation }
      : undefined,
    histogram,
  };
}

/** MIREX-style weighted key score: exact 1, fifth 0.5, relative 0.3, parallel 0.2, other 0. */
export function mirexKeyScore(estimated: Key, truth: Key): number {
  if (sameKey(estimated, truth)) return 1;
  const rel = keyRelation(truth, estimated);
  if (rel === "dominant" || rel === "subdominant") return 0.5;
  if (rel === "relative") return 0.3;
  if (rel === "parallel") return 0.2;
  return 0;
}
