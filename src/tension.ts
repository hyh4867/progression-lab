/**
 * Tension model after Lerdahl's Tonal Pitch Space (Lerdahl 2001), simplified — see docs/tension_model.md.
 *
 *   δ(x → y) = i + j + k
 *     i  region distance: steps between the two chords' local keys on the circle of fifths of key signatures
 *     j  chordal distance: root steps on the diatonic circle of fifths of y's region (chromatic circle if a
 *        root lies outside that collection)
 *     k  basic-space distance: pitch classes of y's basic space that are new at each level (a root, b root+5th,
 *        c chord tones, d diatonic collection ∪ chord tones)
 *
 *   tension(n) = δ(tonic → chord_n) + λ · δ(chord_{n-1} → chord_n) + surface(chord_n)
 */
import type { Chord } from "./chord";
import { analyseChord, analyseProgression, type ChordAnalysis } from "./analysis";
import { diatonicSet, signatureDistance, type Key } from "./key";
import { mod12 } from "./pitch";
import { parseChord } from "./chord";
import type { ProgressionItem } from "./progression";

export const SEQUENTIAL_WEIGHT = 0.5;

/** Surface-dissonance weights for added tones (heuristic, in TPS units). */
export const SURFACE_WEIGHTS: Record<string, number> = {
  "6": 0.5, "9": 0.5, "11": 1, "13": 1,
  b7: 1, "7": 1, bb7: 1,
  b9: 2, "#9": 1.5, "#11": 1.5, b13: 1.5,
  b5: 1, "#5": 1,
};
export const SUS_WEIGHT = 1;
export const INVERSION_WEIGHT = 1;

type Levels = [Set<number>, Set<number>, Set<number>, Set<number>];

export function basicSpace(chord: Chord, region: Key): Levels {
  const a = new Set([chord.root]);
  const fifth = chord.tones.find((t) => t.role === "fifth");
  const b = new Set([chord.root, ...(fifth ? [mod12(chord.root + fifth.interval)] : [])]);
  const c = new Set(chord.pcs);
  const d = new Set([...diatonicSet(region), ...chord.pcs]);
  return [a, b, c, d];
}

/** Lerdahl's k: number of pitch classes new at each level of y's basic space relative to x's. */
export function basicSpaceDistance(x: Levels, y: Levels): number {
  let k = 0;
  for (let level = 0; level < 4; level++) {
    for (const pc of y[level]) if (!x[level].has(pc)) k++;
  }
  return k;
}

/** Steps on the chromatic circle of fifths between two pitch classes (0..6). */
export function fifthsDistance(a: number, b: number): number {
  const f = mod12((b - a) * 7);
  return Math.min(f, 12 - f);
}

/** Steps on the diatonic circle of fifths of `region` (0..3), or null if a root is outside the collection. */
export function diatonicFifthsDistance(a: number, b: number, region: Key): number | null {
  const set = diatonicSet(region);
  if (!set.includes(a) || !set.includes(b)) return null;
  const majorTonic = region.mode === "major" ? region.tonic : mod12(region.tonic + 3);
  const start = mod12(majorTonic + 5); // the "F" of the collection starts the chain F C G D A E B
  const ia = mod12((a - start) * 7);
  const ib = mod12((b - start) * 7);
  const d = Math.abs(ia - ib);
  return Math.min(d, 7 - d);
}

export function chordalDistance(x: Chord, y: Chord, regionY: Key): number {
  return diatonicFifthsDistance(x.root, y.root, regionY) ?? fifthsDistance(x.root, y.root);
}

export interface Placed {
  chord: Chord;
  region: Key;
}

export function delta(x: Placed, y: Placed): { i: number; j: number; k: number; total: number } {
  const i = signatureDistance(x.region, y.region);
  const j = chordalDistance(x.chord, y.chord, y.region);
  const k = basicSpaceDistance(basicSpace(x.chord, x.region), basicSpace(y.chord, y.region));
  return { i, j, k, total: i + j + k };
}

export function surfaceDissonance(chord: Chord): number {
  let s = 0;
  for (const t of chord.tones) {
    if (t.role === "root" || t.role === "third") continue;
    if (t.role === "fifth") {
      if (chord.triad !== "diminished" && chord.triad !== "augmented" && t.label !== "5") s += SURFACE_WEIGHTS[t.label] ?? 0;
      continue;
    }
    s += SURFACE_WEIGHTS[t.label] ?? 0;
  }
  if (chord.triad === "sus2" || chord.triad === "sus4") s += SUS_WEIGHT;
  if (chord.hasSlash) s += INVERSION_WEIGHT;
  return s;
}

/**
 * Local region (key) a chord is heard in: applied chords (V/x, vii°/x) are placed in the region of their
 * target (tonicisation); every other chord, including borrowed ones, in the home key.
 */
export function localRegion(a: ChordAnalysis, key: Key): Key {
  if ((a.category === "secondary-dominant" || a.category === "secondary-leading-tone") && a.targetOffset !== undefined) {
    const target = a.targetOffset;
    const minorTargets = key.mode === "major" ? [2, 4, 9] : [5];
    return { tonic: mod12(key.tonic + target), mode: minorTargets.includes(target) ? "minor" : "major" };
  }
  // Simplification: modal-mixture chords stay in the home region; their foreign tones are counted at level d.
  return key;
}

export function tonicChord(key: Key): Chord {
  const names = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return parseChord(names[key.tonic] + (key.mode === "minor" ? "m" : ""));
}

export interface TensionPoint {
  total: number;
  tonic: number; // δ(tonic → chord)
  sequential: number; // λ·δ(prev → chord), 0 for the first chord
  surface: number;
}

/** Tension of a single chord against the tonic (no sequential term). */
export function tonalTension(chord: Chord, key: Key, analysis?: ChordAnalysis): number {
  const a = analysis ?? analyseProgression([{ chord, duration: 1, bar: 0 }], key)[0];
  return delta({ chord: tonicChord(key), region: key }, { chord, region: localRegion(a, key) }).total + surfaceDissonance(chord);
}

/**
 * Per-chord tension. With `regionKeys` (one key per chord, from the key-region analysis), a chord inside a
 * region other than the home key is measured against that region's tonic, plus Lerdahl's regional distance
 * (key-signature steps) for being in that region: δ(I_R → chord in R) + i(home, R). Without region keys,
 * or for chords in the home region, it is δ(I_home → chord) as before, so single-key progressions are unchanged.
 */
export function tensionCurve(items: ProgressionItem[], key: Key, analyses?: ChordAnalysis[], regionKeys?: (Key | null | undefined)[]): TensionPoint[] {
  const an = analyses ?? analyseProgression(items, key);
  const tonic: Placed = { chord: tonicChord(key), region: key };
  const regionOf = (n: number): Key => {
    const r = regionKeys?.[n];
    return r && !(r.tonic === key.tonic && r.mode === key.mode) ? r : key;
  };
  const placed: Placed[] = items.map((it, n) => {
    const R = regionOf(n);
    if (R === key) return { chord: it.chord, region: localRegion(an[n], key) };
    const a = analyseChord(it.chord, R, items[n + 1]?.chord, { prev: items[n - 1]?.chord });
    return { chord: it.chord, region: localRegion(a, R) };
  });
  return placed.map((p, n) => {
    const R = regionOf(n);
    const t = R === key
      ? delta(tonic, p).total
      : delta({ chord: tonicChord(R), region: R }, p).total + signatureDistance(key, R);
    // At a region boundary the previous chord is re-heard in the new region (pivot reinterpretation), so the
    // region shift is not counted twice (it is already in the regional term above).
    let prevPlaced = placed[n - 1];
    if (n > 0 && regionKeys && regionOf(n - 1) !== R) {
      const a = analyseChord(items[n - 1].chord, R, items[n].chord, { prev: items[n - 2]?.chord });
      prevPlaced = { chord: items[n - 1].chord, region: localRegion(a, R) };
    }
    const seq = n === 0 ? 0 : SEQUENTIAL_WEIGHT * delta(prevPlaced, p).total;
    const surface = surfaceDissonance(p.chord);
    return { total: t + seq + surface, tonic: t, sequential: seq, surface };
  });
}
