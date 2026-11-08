/**
 * Circle-of-fifths model of a progression (pure; the UI draws it with SVG).
 *
 * 12 spokes in fifths order with C at 12 o'clock and G clockwise. Three rings:
 *   outer  = major family (major, 7, maj7, 6, sus, aug, power) on the spoke of its root;
 *   middle = minor family (m, m7, m6, m(maj7)) on the spoke of its relative major (Am under C);
 *   inner  = diminished / half-diminished on the spoke of the major key it is vii° of (B° under C).
 * Root motion between consecutive chords is classified by steps around the circle of fifths.
 */
import type { Chord } from "./chord";
import type { ChordAnalysis } from "./analysis";
import { spellInKey, type Key } from "./key";
import { SHARP_NAMES, mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";
import type { Region } from "./regions";
import type { Span } from "./structure";

export type Ring = "outer" | "middle" | "inner";
export const RINGS: Ring[] = ["outer", "middle", "inner"];

/** Pitch classes in fifths order starting at C (spoke 0 = 12 o'clock, clockwise). */
export const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

export function spokeOfPc(pc: number): number {
  return FIFTHS.indexOf(mod12(pc));
}

/** Angle of a spoke in degrees, 0 = 12 o'clock, clockwise. */
export function spokeAngle(spoke: number): number {
  return (((spoke % 12) + 12) % 12) * 30;
}

export function ringOf(chord: Chord): Ring {
  if (chord.triad === "diminished") return "inner";
  if (chord.triad === "minor") return "middle";
  return "outer"; // major, augmented, sus2/sus4, power
}

/** Spoke of a chord root on a given ring (minor → relative major; diminished → the key it is vii° of). */
export function spokeOf(rootPc: number, ring: Ring): number {
  if (ring === "middle") return spokeOfPc(rootPc + 3);
  if (ring === "inner") return spokeOfPc(rootPc + 1);
  return spokeOfPc(rootPc);
}

/** Root pitch class of the slot on a ring at a spoke (inverse of spokeOf). */
export function slotRootPc(spoke: number, ring: Ring): number {
  const major = FIFTHS[((spoke % 12) + 12) % 12];
  return ring === "middle" ? mod12(major - 3) : ring === "inner" ? mod12(major - 1) : major;
}

/** Key-aware slot label: "F#" vs "Gb", "C#m" vs "Dbm", "B°". */
export function slotLabel(spoke: number, ring: Ring, key: Key): string {
  // Key-aware spelling, except that E#, B#, Fb and Cb read badly as chord names: use F, C, E, B instead.
  const pc = slotRootPc(spoke, ring);
  let name = spellInKey(pc, key);
  if (["E#", "B#", "Fb", "Cb"].includes(name)) name = SHARP_NAMES[pc];
  return ring === "middle" ? name + "m" : ring === "inner" ? name + "°" : name;
}

/* ---------------- key window ---------------- */

export interface KeyWindow {
  centre: number; // spoke of the (relative) major tonic
  spokes: number[]; // IV, I, V spokes
  tonicRing: Ring; // outer for major, middle for minor
}

export function keyWindow(key: Key): KeyWindow {
  const majorTonic = key.mode === "major" ? key.tonic : mod12(key.tonic + 3);
  const centre = spokeOfPc(majorTonic);
  return { centre, spokes: [(centre + 11) % 12, centre, (centre + 1) % 12], tonicRing: key.mode === "major" ? "outer" : "middle" };
}

/**
 * The diatonic wedge: IV–I–V on the outer ring, ii–vi–iii on the middle ring, vii° on the inner ring
 * (the inner slot of the centre spoke). In minor, V (harmonic minor) is also accepted as in-key.
 */
export function inKeyWindow(rootPc: number, ring: Ring, key: Key): boolean {
  const w = keyWindow(key);
  const spoke = spokeOf(rootPc, ring);
  if (ring === "inner") {
    if (spoke === w.centre) return true;
    return key.mode === "minor" && mod12(rootPc - key.tonic) === 11; // harmonic-minor vii°
  }
  if (w.spokes.includes(spoke)) return true;
  return key.mode === "minor" && ring === "outer" && mod12(rootPc - key.tonic) === 7; // harmonic-minor V
}

/* ---------------- path ---------------- */

export interface CircleNode {
  id: string; // `${ring}:${spoke}`
  ring: Ring;
  spoke: number;
  rootPc: number;
  label: string; // slot label (e.g. "Am")
  indices: number[]; // chord indices placed on this node
  inKey: boolean;
}

export type MotionKind = "falling-fifth" | "rising-fifth" | "relative" | "second" | "third" | "semitone" | "tritone" | "same-root";
export const MOTION_KINDS: MotionKind[] = ["falling-fifth", "rising-fifth", "relative", "second", "third", "semitone", "tritone", "same-root"];

export interface Move {
  from: number; // chord index
  to: number;
  fromNode: string;
  toNode: string;
  kind: MotionKind;
  steps: number; // signed steps around the circle of roots (+ = clockwise)
}

export interface CirclePath {
  nodes: CircleNode[];
  /** node id of every chord, in order. */
  chordNode: string[];
  moves: Move[];
}

/** Root used on the circle: the analysed root (symmetric chords may be re-rooted). */
function rootOf(chord: Chord, a: ChordAnalysis | undefined, key: Key): number {
  return a ? mod12(key.tonic + a.rootOffset) : chord.root;
}

export function classifyMove(fromRoot: number, fromRing: Ring, toRoot: number, toRing: Ring, fromDevice?: string): { kind: MotionKind; steps: number } {
  let steps = spokeOfPc(toRoot) - spokeOfPc(fromRoot);
  if (steps > 6) steps -= 12;
  if (steps < -6) steps += 12;
  const relative =
    (fromRing === "outer" && toRing === "middle" && mod12(fromRoot - toRoot) === 3) ||
    (fromRing === "middle" && toRing === "outer" && mod12(toRoot - fromRoot) === 3);
  if (relative) return { kind: "relative", steps };
  // A tritone substitute replaces the dominant on the opposite spoke, so its resolution is drawn as the tritone line.
  if (fromDevice === "tritone-sub") return { kind: "tritone", steps };
  const s = Math.abs(steps);
  if (s === 0) return { kind: "same-root", steps };
  if (s === 1) return { kind: steps < 0 ? "falling-fifth" : "rising-fifth", steps };
  if (s === 2) return { kind: "second", steps };
  if (s === 3 || s === 4) return { kind: "third", steps };
  if (s === 5) return { kind: "semitone", steps };
  return { kind: "tritone", steps };
}

export function buildCirclePath(items: ProgressionItem[], analyses: ChordAnalysis[], key: Key): CirclePath {
  const nodes = new Map<string, CircleNode>();
  const chordNode: string[] = [];
  items.forEach((it, i) => {
    const ring = ringOf(it.chord);
    const root = rootOf(it.chord, analyses[i], key);
    const spoke = spokeOf(root, ring);
    const id = `${ring}:${spoke}`;
    let node = nodes.get(id);
    if (!node) {
      node = { id, ring, spoke, rootPc: root, label: slotLabel(spoke, ring, key), indices: [], inKey: inKeyWindow(root, ring, key) };
      nodes.set(id, node);
    }
    node.indices.push(i);
    chordNode.push(id);
  });
  const moves: Move[] = [];
  for (let i = 1; i < items.length; i++) {
    if (chordNode[i] === chordNode[i - 1]) continue; // same node: no visible move
    const a = nodes.get(chordNode[i - 1])!, b = nodes.get(chordNode[i])!;
    const c = classifyMove(a.rootPc, a.ring, b.rootPc, b.ring, analyses[i - 1]?.device);
    moves.push({ from: i - 1, to: i, fromNode: a.id, toNode: b.id, ...c });
  }
  return { nodes: [...nodes.values()], chordNode, moves };
}

/* ---------------- patterns & summary ---------------- */

export interface FifthsChain {
  start: number; // chord index
  end: number;
}

/** Runs of at least 3 consecutive falling-fifth moves (4+ chords). */
export function fallingFifthChains(path: CirclePath): FifthsChain[] {
  const out: FifthsChain[] = [];
  let run: Move[] = [];
  const flush = () => {
    if (run.length >= 3) out.push({ start: run[0].from, end: run[run.length - 1].to });
    run = [];
  };
  for (const m of path.moves) {
    if (m.kind === "falling-fifth" && (run.length === 0 || run[run.length - 1].to === m.from)) run.push(m);
    else { flush(); if (m.kind === "falling-fifth") run.push(m); }
  }
  flush();
  return out;
}

/** Coltrane triangle: the three distinct key centres of a detected Coltrane-cycle span, as outer-ring spokes. */
export function coltraneTriangle(items: ProgressionItem[], spans: Span[]): number[] | null {
  const span = spans.find((s) => s.type === "coltrane-cycle");
  if (!span) return null;
  const centres: number[] = [];
  for (let i = span.start; i <= span.end; i++) {
    const c = items[i].chord;
    const prev = items[i - 1]?.chord;
    const arrival = i === span.start || (prev && mod12(prev.root - c.root) === 7 && prev.seventh === "minor7");
    if (arrival && (c.triad === "major" || c.triad === "minor")) {
      const s = spokeOfPc(c.root);
      if (!centres.includes(s)) centres.push(s);
    }
  }
  return centres.length >= 3 ? centres.slice(0, 3) : null;
}

/** Two-chord vamp: the whole progression alternates between exactly two nodes (at least 3 chords). */
export function twoChordVamp(path: CirclePath): [string, string] | null {
  const ids = path.chordNode;
  if (ids.length < 3) return null;
  const distinct = [...new Set(ids)];
  if (distinct.length !== 2) return null;
  for (let i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) return null;
  return [distinct[0], distinct[1]];
}

export interface MotionSummary {
  total: number;
  counts: Record<MotionKind, number>;
  top: MotionKind | null;
  topCount: number;
}

export function motionSummary(path: CirclePath): MotionSummary {
  const counts = Object.fromEntries(MOTION_KINDS.map((k) => [k, 0])) as Record<MotionKind, number>;
  for (const m of path.moves) counts[m.kind]++;
  let top: MotionKind | null = null;
  for (const k of MOTION_KINDS) if (counts[k] > 0 && (top === null || counts[k] > counts[top])) top = k;
  return { total: path.moves.length, counts, top, topCount: top ? counts[top] : 0 };
}

/** Index of the region that contains a chord (for the active wedge). */
export function regionAt(regions: Region[], chordIndex: number): number {
  return regions.findIndex((r) => chordIndex >= r.start && chordIndex <= r.end);
}

/* ---------------- geometry ---------------- */

export const GEOMETRY = {
  size: 420,
  centre: 210,
  labelRadius: 192,
  ringRadius: { outer: 158, middle: 116, inner: 76 } as Record<Ring, number>,
  wedgeInner: 56,
  wedgeOuter: 178,
};

export function point(spoke: number, radius: number): { x: number; y: number } {
  const a = (spokeAngle(spoke) * Math.PI) / 180;
  return { x: GEOMETRY.centre + radius * Math.sin(a), y: GEOMETRY.centre - radius * Math.cos(a) };
}

export function nodePoint(node: { spoke: number; ring: Ring }): { x: number; y: number } {
  return point(node.spoke, GEOMETRY.ringRadius[node.ring]);
}
