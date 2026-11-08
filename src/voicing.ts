/**
 * Guitar voicings in standard tuning and a Viterbi (dynamic-programming) voicing path.
 * Strings are indexed 0..5 from low E to high E. A voicing is six frets (null = muted).
 */
import type { Chord } from "./chord";
import { mod12 } from "./pitch";
import { tonicName, type Key, type Mode } from "./key";

export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]; // MIDI: E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];

export interface Voicing {
  frets: (number | null)[];
  notes: number[]; // MIDI notes, low to high
  position: number; // lowest fretted fret (0 if only open strings)
  span: number;
  fingers: number;
  barre: boolean;
  difficulty: number;
}

export interface VoicingOptions {
  maxFret?: number; // highest fret allowed (default 15)
  maxSpan?: number; // max distance between lowest and highest fretted note (default 3 → a 4-fret window)
  bassFree?: boolean; // if true, the lowest note need not be the chord's bass
  maxPerChord?: number; // keep the N easiest voicings (default 24)
}

export interface DifficultyWeights {
  finger: number; // per finger used
  span: number; // per fret between lowest and highest fretted note
  barre: number; // a barre is needed
  innerMute: number; // per muted string between sounding strings
  mutedString: number; // per muted string (fuller chords strum better)
  openString: number; // per open string in open position (negative = bonus)
  openStringHigh: number; // per open string when the hand is at fret 5 or higher
  height: number; // per fret of hand position
  omittedTone: number; // per optional chord tone left out (e.g. the 5th)
}

/** Heuristic weights, hand-set (not fitted); see docs/progression_lab.md. */
export const DIFFICULTY: DifficultyWeights = {
  finger: 0.6, span: 0.5, barre: 1.0, innerMute: 1.2, mutedString: 1.0, openString: -0.3, openStringHigh: 1.0,
  height: 0.1, omittedTone: 0.5,
};

/** Every tone that must sound: all non-optional chord tones (the unaltered 5th etc. may be omitted). */
export function requiredPcs(chord: Chord): number[] {
  return [...new Set(chord.tones.filter((t) => !t.optional).map((t) => mod12(chord.root + t.interval)))];
}

function analyse(frets: (number | null)[], tuning: number[]): Omit<Voicing, "difficulty"> & { innerMutes: number; open: number; muted: number } {
  const notes: number[] = [];
  const fretted: number[] = [];
  let open = 0;
  frets.forEach((f, s) => {
    if (f === null) return;
    notes.push(tuning[s] + f);
    if (f === 0) open++;
    else fretted.push(f);
  });
  const sounding = frets.map((f, s) => (f === null ? -1 : s)).filter((s) => s >= 0);
  const lo = sounding[0], hi = sounding[sounding.length - 1];
  let innerMutes = 0;
  for (let s = lo; s <= hi; s++) if (frets[s] === null) innerMutes++;
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  // Barre: the index finger lies across every string from the first one fretted at minF upwards.
  // It is possible only if no open string lies above that string.
  const atMin = frets.map((f, s) => (f === minF && minF > 0 ? s : -1)).filter((s) => s >= 0);
  let barre = false;
  let fingers = fretted.length;
  if (atMin.length >= 2 && fretted.length > 4) {
    const first = atMin[0];
    const openAbove = frets.some((f, s) => s > first && f === 0);
    const lowerAbove = frets.some((f, s) => s > first && f !== null && f > 0 && f < minF);
    if (!openAbove && !lowerAbove) {
      barre = true;
      fingers = 1 + fretted.filter((f) => f > minF).length;
    }
  }
  return {
    frets, notes, position: minF, span: maxF - minF, fingers, barre, innerMutes, open, muted: 6 - sounding.length,
  };
}

export function voicingDifficulty(frets: (number | null)[], tuning = STANDARD_TUNING, w = DIFFICULTY, chord?: Chord): number {
  const a = analyse(frets, tuning);
  const maxFret = Math.max(0, ...frets.map((f) => f ?? 0));
  const openWeight = maxFret <= 4 ? w.openString : maxFret >= 5 ? w.openStringHigh : 0;
  let omitted = 0;
  if (chord) {
    const sounding = new Set(a.notes.map(mod12));
    omitted = chord.pcs.filter((pc) => !sounding.has(pc)).length;
  }
  return (
    w.finger * a.fingers + w.span * a.span + (a.barre ? w.barre : 0) + w.innerMute * a.innerMutes +
    w.mutedString * a.muted + openWeight * a.open + w.height * a.position + w.omittedTone * omitted
  );
}

/** All playable voicings of a chord, easiest first. */
export function generateVoicings(chord: Chord, opts: VoicingOptions = {}, tuning = STANDARD_TUNING): Voicing[] {
  const maxFret = opts.maxFret ?? 15;
  const maxSpan = opts.maxSpan ?? 3;
  const keep = opts.maxPerChord ?? 24;
  const pcs = new Set(chord.pcs);
  const required = requiredPcs(chord);
  const minStrings = Math.max(3, Math.min(required.length + (pcs.has(chord.bass) ? 0 : 1), 6));
  const seen = new Set<string>();
  const out: Voicing[] = [];

  for (let w = 1; w <= Math.max(1, maxFret - maxSpan); w++) {
    const options: (number | null)[][] = tuning.map((open) => {
      // Chord tones anywhere; a non-chord slash bass (e.g. Am/G#) only as the lowest note (checked below).
      const ok = (pc: number) => pcs.has(pc) || pc === chord.bass;
      const o: (number | null)[] = [null];
      if (ok(mod12(open))) o.push(0);
      for (let f = w; f <= Math.min(w + maxSpan, maxFret); f++) if (ok(mod12(open + f))) o.push(f);
      return o;
    });
    const frets: (number | null)[] = new Array(6).fill(null);
    const rec = (s: number, started: boolean) => {
      if (s === 6) {
        const key = frets.join(",");
        if (seen.has(key)) return;
        const sounding = frets.filter((f) => f !== null).length;
        if (sounding < minStrings) return;
        const notePcs = new Set(frets.map((f, i) => (f === null ? -1 : mod12(tuning[i] + f))).filter((x) => x >= 0));
        if (!required.every((pc) => notePcs.has(pc))) return;
        const fretted = frets.filter((f): f is number => f !== null && f > 0);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > maxSpan) return;
        const a = analyse(frets, tuning);
        if (a.fingers > 4 || a.innerMutes > 1) return;
        seen.add(key);
        out.push({
          frets: [...frets], notes: a.notes, position: a.position, span: a.span, fingers: a.fingers, barre: a.barre,
          difficulty: voicingDifficulty(frets, tuning, DIFFICULTY, chord),
        });
        return;
      }
      for (const f of options[s]) {
        if (started && f !== null && !pcs.has(mod12(tuning[s] + f))) continue; // foreign bass only at the bottom
        if (!started && f !== null) {
          // The lowest sounding string carries the bass and must be one of the three lowest strings.
          if (s > 2) continue;
          if (!opts.bassFree && mod12(tuning[s] + f) !== chord.bass) continue;
        }
        if (!started && f === null && s >= 2) continue; // would put the bass above the D string
        frets[s] = f;
        rec(s + 1, started || f !== null);
        frets[s] = null;
      }
    };
    rec(0, false);
  }
  out.sort((a, b) => a.difficulty - b.difficulty || a.position - b.position || a.frets.join().localeCompare(b.frets.join()));
  return out.slice(0, keep);
}

/* ---------- path optimisation ---------- */

export interface PathWeights {
  movement: number; // per fret of hand-position change
  voiceLeading: number; // per semitone of average voice movement
  difficulty: number;
}

export const PATH_WEIGHTS: PathWeights = { movement: 0.6, voiceLeading: 0.4, difficulty: 1 };

/** Symmetric mean nearest-note distance (semitones) between two voicings' sounding notes. */
export function voicingVoiceLeading(a: Voicing, b: Voicing): number {
  const near = (x: number, set: number[]) => Math.min(...set.map((y) => Math.abs(x - y)));
  const ab = b.notes.reduce((s, x) => s + near(x, a.notes), 0) / b.notes.length;
  const ba = a.notes.reduce((s, x) => s + near(x, b.notes), 0) / a.notes.length;
  return (ab + ba) / 2;
}

/** Hand position used for movement: lowest fretted fret, with all-open shapes counted as first position. */
function handPosition(v: Voicing): number {
  return v.position === 0 ? 1 : v.position;
}

export function transitionCost(a: Voicing, b: Voicing, w = PATH_WEIGHTS): number {
  return w.movement * Math.abs(handPosition(a) - handPosition(b)) + w.voiceLeading * voicingVoiceLeading(a, b);
}

export function pathCost(path: Voicing[], w = PATH_WEIGHTS): number {
  let c = 0;
  path.forEach((v, i) => {
    c += w.difficulty * v.difficulty;
    if (i > 0) c += transitionCost(path[i - 1], v, w);
  });
  return c;
}

/** Viterbi: one voicing per chord minimising total difficulty + movement + voice-leading. */
export function optimiseVoicingPath(candidates: Voicing[][], w = PATH_WEIGHTS): { path: Voicing[]; indices: number[]; cost: number } {
  const n = candidates.length;
  if (n === 0) return { path: [], indices: [], cost: 0 };
  if (candidates.some((c) => c.length === 0)) throw new Error("A chord has no playable voicing");
  let cost = candidates[0].map((v) => w.difficulty * v.difficulty);
  const back: number[][] = [candidates[0].map(() => -1)];
  for (let i = 1; i < n; i++) {
    const next: number[] = [];
    const bp: number[] = [];
    for (const [j, v] of candidates[i].entries()) {
      let best = Infinity, arg = -1;
      for (const [k, u] of candidates[i - 1].entries()) {
        const c = cost[k] + transitionCost(u, v, w);
        if (c < best - 1e-12) { best = c; arg = k; }
      }
      next.push(best + w.difficulty * v.difficulty);
      bp.push(arg);
    }
    cost = next;
    back.push(bp);
  }
  let end = 0;
  for (let j = 1; j < cost.length; j++) if (cost[j] < cost[end] - 1e-12) end = j;
  const indices = new Array(n);
  indices[n - 1] = end;
  for (let i = n - 1; i > 0; i--) indices[i - 1] = back[i][indices[i]];
  const path = indices.map((j, i) => candidates[i][j]);
  return { path, indices, cost: cost[end] };
}

/** Exhaustive search (for testing the DP on small cases). */
export function bruteForceVoicingPath(candidates: Voicing[][], w = PATH_WEIGHTS): { indices: number[]; cost: number } {
  let best = Infinity;
  let bestIdx: number[] = [];
  const idx: number[] = [];
  const rec = (i: number) => {
    if (i === candidates.length) {
      const c = pathCost(idx.map((j, k) => candidates[k][j]), w);
      if (c < best - 1e-12) { best = c; bestIdx = [...idx]; }
      return;
    }
    for (let j = 0; j < candidates[i].length; j++) { idx.push(j); rec(i + 1); idx.pop(); }
  };
  rec(0);
  return { indices: bestIdx, cost: best };
}

/* ---------- capo & tab ---------- */

export function capoFret(targetTonic: number, shapeTonic: number): number {
  return mod12(targetTonic - shapeTonic);
}

const OPEN_SHAPE_KEYS: Record<Mode, number[]> = { major: [0, 7, 2, 9, 4], minor: [9, 4, 2] }; // C G D A E / Am Em Dm

/** "Play in key X using shapes from key Y": every open-friendly shape key with its capo fret (≤ 7), lowest capo first. */
export function capoSuggestions(target: Key): { shapeKey: Key; shapeName: string; capo: number }[] {
  return OPEN_SHAPE_KEYS[target.mode]
    .map((t) => {
      const shapeKey: Key = { tonic: t, mode: target.mode };
      return { shapeKey, shapeName: tonicName(shapeKey) + (target.mode === "minor" ? "m" : ""), capo: capoFret(target.tonic, t) };
    })
    .filter((s) => s.capo <= 7)
    .sort((a, b) => a.capo - b.capo);
}

export function formatFrets(v: Voicing): string {
  return v.frets.map((f) => (f === null ? "x" : f > 9 ? `(${f})` : String(f))).join("");
}

/** Plain-text tab, high e on top, one column per chord. */
export function formatTab(names: string[], path: Voicing[], capo = 0): string {
  const cols = path.map((v, i) => {
    const cells = v.frets.map((f) => (f === null ? "x" : String(f)));
    const width = Math.max(names[i].length, ...cells.map((c) => c.length)) + 2;
    return { name: names[i].padEnd(width), cells: cells.map((c) => c.padEnd(width, "-")), width };
  });
  const header = "  " + cols.map((c) => c.name).join("");
  const lines = [5, 4, 3, 2, 1, 0].map((s) => STRING_NAMES[s] + "|" + cols.map((c) => c.cells[s]).join("") + "|");
  return (capo > 0 ? `Capo ${capo}\n` : "") + [header, ...lines].join("\n");
}
