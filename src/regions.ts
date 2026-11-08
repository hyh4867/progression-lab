/**
 * Key regions: sliding-window Krumhansl–Kessler evidence per chord, plus a cadence bonus for V(7) → I
 * arrivals, smoothed by dynamic programming (Viterbi over the 24 keys) with a modulation penalty.
 * Regions are then labelled home / modulation / tonicisation, and pivot chords are found at the
 * boundaries of modulations.
 */
import { ALL_KEYS, diatonicSet, keyShortName, sameKey, type Key } from "./key";
import { KK_MAJOR, KK_MINOR, pearson } from "./keyfinding";
import { mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";
import { analyseChord, corePcs } from "./analysis";
import { detectSpans } from "./structure";

/** Fixed design parameters (set from synthetic cases, never from the labelled sets). */
export const REGION_PARAMS = {
  windowWeights: [0.3, 0.6, 1, 0.6, 0.3], // chords i−2 … i+2
  anchorBonus: 1.2, // added to the key of an authentic arrival on its (ii–)V and I chords (beats a 2-chord switch)
  switchPenalty: 0.9, // cost of changing key between neighbouring chords
  homeBonus: 0.05, // small prior for the global key
  startBonus: 0.9, // prior for starting in the home key (= one switch); a cadence anchor (1.2) outweighs it
  minModulationChords: 3, // shorter non-home regions are tonicisations
};

export type RegionKind = "home" | "modulation" | "tonicisation";

export interface Region {
  key: Key;
  name: string; // "G", "Eb", "Am"
  start: number;
  end: number; // inclusive
  kind: RegionKind;
}

export interface Pivot {
  index: number;
  from: Key;
  to: Key;
  fromRoman: string;
  toRoman: string;
}

export interface RegionResult {
  regions: Region[];
  pivots: Pivot[];
  /** Per-chord key after smoothing. */
  path: Key[];
}

function keyScores(hist: number[]): number[] {
  return ALL_KEYS.map((k) => {
    const profile = k.mode === "major" ? KK_MAJOR : KK_MINOR;
    return pearson(hist, hist.map((_, pc) => profile[mod12(pc - k.tonic)]));
  });
}

function isDominantish(c: ProgressionItem["chord"]): boolean {
  return (c.triad === "major" || c.triad === "augmented") && (c.seventh === "none" || c.seventh === "minor7");
}

export interface Anchor {
  key: Key;
  start: number; // first chord of the approach (ii or V), or the centre itself
  end: number; // the arrival chord
}

/**
 * Cadence anchors: authentic arrivals V(7) → I/i (maj7 and m7 tonics included; a dominant-seventh
 * "arrival" is a chain link, not a tonic), with a preceding ii (m7 / m7b5 a fifth above the V) included.
 * In a detected Coltrane cycle, a centre that starts the cycle without its own V is anchored too.
 */
export function cadenceAnchors(items: ProgressionItem[], home: Key): Anchor[] {
  const out: Anchor[] = [];
  for (let i = 1; i < items.length; i++) {
    const v = items[i - 1].chord, c = items[i].chord;
    if (!isDominantish(v) || mod12(v.root - c.root) !== 7) continue;
    if (!(c.triad === "major" || c.triad === "minor")) continue;
    if (c.triad === "major" && c.seventh === "minor7") continue;
    let start = i - 1;
    const ii = items[i - 2]?.chord;
    if (ii && (ii.triad === "minor" || ii.triad === "diminished") && mod12(ii.root - v.root) === 7) start = i - 2;
    out.push({ key: { tonic: c.root, mode: c.triad === "major" ? "major" : "minor" }, start, end: i });
  }
  for (const sp of detectSpans(items, home)) {
    if (sp.type !== "coltrane-cycle") continue;
    const c = items[sp.start].chord;
    if (!out.some((a) => a.end === sp.start) && (c.triad === "major" || c.triad === "minor")) {
      out.push({ key: { tonic: c.root, mode: c.triad === "major" ? "major" : "minor" }, start: sp.start, end: sp.start });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function fitsKey(pcs: number[], key: Key): boolean {
  const set = new Set(diatonicSet(key));
  if (key.mode === "minor") set.add(mod12(key.tonic + 11));
  return pcs.every((pc) => set.has(pc));
}

export function analyseRegions(items: ProgressionItem[], home: Key): RegionResult {
  const n = items.length;
  if (n === 0) return { regions: [], pivots: [], path: [] };
  const P = REGION_PARAMS;
  const half = Math.floor(P.windowWeights.length / 2);
  const evidence: number[][] = [];
  for (let i = 0; i < n; i++) {
    const h = new Array(12).fill(0);
    for (let d = -half; d <= half; d++) {
      const j = i + d;
      if (j < 0 || j >= n) continue;
      const w = P.windowWeights[d + half] * items[j].duration;
      for (const pc of new Set([...items[j].chord.pcs, items[j].chord.bass])) h[pc] += w;
    }
    evidence.push(keyScores(h));
  }
  // Cadence anchors: strong evidence for the local key on the approach and the arrival.
  for (const a of cadenceAnchors(items, home)) {
    const kIdx = ALL_KEYS.findIndex((k) => sameKey(k, a.key));
    for (let j = a.start; j <= a.end; j++) evidence[j][kIdx] += P.anchorBonus;
  }
  const homeIdx = ALL_KEYS.findIndex((k) => sameKey(k, home));
  for (let i = 0; i < n; i++) evidence[i][homeIdx] += P.homeBonus;

  // Viterbi: maximise Σ evidence − switchPenalty · #changes. Ties prefer staying, then the home key.
  const K = ALL_KEYS.length;
  // The home key (detected or chosen) is only a prior at the start: a cadence-confirmed key overrides it.
  let score = evidence[0].map((v, k) => (k === homeIdx ? v + P.startBonus : v));
  const back: number[][] = [new Array(K).fill(-1)];
  for (let i = 1; i < n; i++) {
    const next = new Array(K).fill(-Infinity);
    const bp = new Array(K).fill(-1);
    let bestPrev = 0;
    for (let k = 1; k < K; k++) if (score[k] > score[bestPrev]) bestPrev = k;
    for (let k = 0; k < K; k++) {
      const stay = score[k];
      const move = score[bestPrev] - P.switchPenalty;
      if (stay >= move) { next[k] = stay + evidence[i][k]; bp[k] = k; }
      else { next[k] = move + evidence[i][k]; bp[k] = bestPrev; }
    }
    score = next;
    back.push(bp);
  }
  let end = homeIdx;
  for (let k = 0; k < K; k++) if (score[k] > score[end] + 1e-12) end = k;
  const idx = new Array(n);
  idx[n - 1] = end;
  for (let i = n - 1; i > 0; i--) idx[i - 1] = back[i][idx[i]];
  const path = idx.map((k: number) => ALL_KEYS[k]);

  // Segments.
  const segment = (keys: Key[]) => {
    const out: Region[] = [];
    for (let i = 0; i < n; i++) {
      const last = out[out.length - 1];
      if (last && sameKey(last.key, keys[i])) last.end = i;
      else out.push({ key: keys[i], name: keyShortName(keys[i]), start: i, end: i, kind: "home" });
    }
    return out;
  };
  let regions = segment(path);
  // Stability: a short region (≤ 3 chords) flanked on BOTH sides by the same key K, whose arrival chord is
  // diatonic in K, is a tonicisation of a degree of K (e.g. A7 → Dm7 in C), so it stays inside K.
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 0; k < regions.length; k++) {
      const r = regions[k];
      if (r.end - r.start + 1 > 3) continue;
      const prev = regions[k - 1], next = regions[k + 1];
      const K = prev && next && sameKey(prev.key, next.key) ? prev.key : null;
      if (!K || sameKey(K, r.key)) continue;
      if (!fitsKey(corePcs(items[r.end].chord), K)) continue;
      for (let j = r.start; j <= r.end; j++) path[j] = K;
      regions = segment(path);
      changed = true;
      break;
    }
  }
  // A progression that never leaves one region is, by definition, in its home key.
  if (regions.length === 1 && !sameKey(regions[0].key, home)) {
    for (let j = 0; j < n; j++) path[j] = home;
    regions = segment(path);
  }
  for (const r of regions) {
    if (sameKey(r.key, home)) r.kind = "home";
    else r.kind = r.end - r.start + 1 >= P.minModulationChords ? "modulation" : "tonicisation";
  }

  // Pivot chords: the last chord before a modulation that is diatonic (core) in both keys.
  const pivots: Pivot[] = [];
  regions.forEach((r, k) => {
    if (k === 0 || r.kind !== "modulation") return;
    const from = regions[k - 1].key;
    const fits = fitsKey;
    for (let j = r.start; j >= Math.max(0, r.start - 2); j--) {
      const c = items[j].chord;
      if (fits(corePcs(c), from) && fits(corePcs(c), r.key)) {
        pivots.push({
          index: j, from, to: r.key,
          fromRoman: analyseChord(c, from).roman,
          toRoman: analyseChord(c, r.key).roman,
        });
        break;
      }
    }
  });
  return { regions, pivots, path };
}
