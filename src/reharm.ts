/**
 * Reharmonisation by beam search over named substitution rules.
 *
 * Each original chord is a "slot". A slot keeps its chord or is replaced by one or two chords that fill
 * the same duration. Slots are processed right-to-left, so rules that aim at the following chord
 * (secondary dominants, ii–V, tritone substitutes, passing diminished chords) always see the chord that
 * actually follows in the candidate. Candidates are scored by
 *   wCurve · RMS(slot tension − target)  +  wVoice · mean voice-leading distance  +  wChange · #changed slots.
 */
import { makeChord, isDominantSeventh, parseChord, qualitySuffix, type Chord } from "./chord";
import { letterOf, spellWithLetter } from "./pitch";
import { spellInKey } from "./key";
import { analyseChord, analyseProgression } from "./analysis";
import type { Key } from "./key";
import { mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";
import { fmtEn, m, type Msg } from "./i18n";
import { tensionCurve } from "./tension";

export type RuleId =
  | "diatonic-substitute"
  | "secondary-dominant"
  | "ii-v"
  | "tritone-substitution"
  | "modal-mixture"
  | "passing-diminished"
  | "deceptive-resolution"
  | "augmented-sixth"
  | "neapolitan-approach"
  | "backdoor-ii-v"
  | "chromatic-mediant";

/** v2 rules, enabled with `advancedRules: true`. */
export const ADVANCED_RULES: RuleId[] = ["augmented-sixth", "neapolitan-approach", "backdoor-ii-v", "chromatic-mediant"];

export const RULE_NAMES: Record<RuleId, string> = {
  "diatonic-substitute": "diatonic function substitute",
  "secondary-dominant": "secondary dominant",
  "ii-v": "ii–V insertion",
  "tritone-substitution": "tritone substitution",
  "modal-mixture": "modal-mixture borrowing",
  "passing-diminished": "passing diminished chord",
  "deceptive-resolution": "deceptive resolution",
  "augmented-sixth": "augmented-sixth approach to V",
  "neapolitan-approach": "Neapolitan approach",
  "backdoor-ii-v": "backdoor ii–V",
  "chromatic-mediant": "chromatic-mediant substitution",
};

export interface Weights {
  curve: number;
  voiceLeading: number;
  change: number;
}

export const DEFAULT_WEIGHTS: Weights = { curve: 1, voiceLeading: 0.5, change: 0.5 };

interface Option {
  chords: Chord[];
  rules: RuleId[]; // empty = unchanged
  detail: Msg | "";
}

export interface Change {
  slot: number;
  rules: RuleId[];
  from: string;
  to: string[];
  text: string;
  textMsg: Msg;
}

export interface Suggestion {
  items: ProgressionItem[];
  changes: Change[];
  slotCurve: number[];
  curveDistance: number;
  voiceLeading: number;
  score: number;
  summary: string;
}

export interface ReharmResult {
  original: { slotCurve: number[]; curveDistance: number; voiceLeading: number; score: number };
  suggestions: Suggestion[];
  message?: string;
  messageMsg?: Msg;
}

export interface ReharmOptions {
  items: ProgressionItem[];
  key: Key;
  target: number[]; // one value per original chord
  locked?: boolean[];
  weights?: Partial<Weights>;
  beamWidth?: number;
  maxResults?: number;
  /** Also try the v2 rules (augmented sixth, Neapolitan, backdoor ii–V, chromatic mediant). */
  advancedRules?: boolean;
  /** Key region of each original slot (from the key-region analysis); substitutes inherit their slot's region. */
  regionKeys?: Key[];
}

/* ---------- theory helpers ---------- */

const MAJOR_DIATONIC: Record<number, [string, string]> = { 0: ["maj", "maj7"], 2: ["m", "m7"], 4: ["m", "m7"], 5: ["maj", "maj7"], 7: ["maj", "7"], 9: ["m", "m7"], 11: ["dim", "m7b5"] };
const MINOR_DIATONIC: Record<number, [string, string]> = { 0: ["m", "m7"], 2: ["dim", "m7b5"], 3: ["maj", "maj7"], 5: ["m", "m7"], 7: ["maj", "7"], 8: ["maj", "maj7"], 10: ["maj", "7"] };

function diatonicTable(key: Key) {
  return key.mode === "major" ? MAJOR_DIATONIC : MINOR_DIATONIC;
}

function diatonicAt(offset: number, key: Key, seventh: boolean): Chord | null {
  const q = diatonicTable(key)[offset];
  if (!q) return null;
  return makeChord(mod12(key.tonic + offset), seventh ? q[1] : q[0], key);
}

function offsetOf(c: Chord, key: Key): number {
  return mod12(c.root - key.tonic);
}

function hasSeventh(c: Chord): boolean {
  return c.seventh !== "none";
}

/**
 * A chord defined relative to a target chord, spelled by letter distance from the target
 * (e.g. the leading-tone dim7 of A is G#dim7, not Abdim7; the tritone substitute of C7's target F is Gb7).
 */
function relChord(target: Chord, letterSteps: number, semitones: number, quality: string, key: Key): Chord {
  const pc = mod12(target.root + semitones);
  const name = spellWithLetter(letterOf(target.rootName) + letterSteps, pc) ?? spellInKey(pc, key);
  return parseChord(name + qualitySuffix(quality));
}

/** Numeral without quality: "V7" → "V", "viiø7" → "vii", "bVImaj7" → "bVI". */
function bareNumeral(roman: string): string {
  const m = /^(b|#)*(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)/.exec(roman);
  return m ? m[0] : roman;
}

/** Chord that the next slot starts with can be approached by an applied dominant / ii–V. */
function approachable(next: Chord, key: Key): boolean {
  return next.triad === "major" || next.triad === "minor";
}

function isDominantOfTonic(c: Chord, key: Key): boolean {
  const a = analyseChord(c, key);
  return (a.category === "diatonic" && a.rootOffset === 7 && c.triad === "major") || (a.category === "tritone-sub" && a.targetOffset === 0);
}

const FUNCTION_WORD: Record<string, Msg> = { T: m("fnw.T"), PD: m("fnw.PD"), D: m("fnw.D") };

/* ---------- rules ---------- */

function generateOptions(cur: Chord, next: Chord | undefined, prev: Chord | undefined, key: Key, duration: number, isLast: boolean, advanced = false): Option[] {
  const out: Option[] = [];
  if (advanced) out.push(...advancedOptions(cur, next, key, duration, isLast));
  const off = offsetOf(cur, key);
  const curA = analyseChord(cur, key, next);
  const sev = hasSeventh(cur);
  const nextA = next ? analyseChord(next, key) : undefined;

  // 1. Diatonic function substitute: diatonic chords a third away share two tones.
  if (curA.category === "diatonic" && diatonicTable(key)[off]) {
    for (const d of [3, 4, -3, -4]) {
      const o = mod12(off + d);
      if (!diatonicTable(key)[o]) continue;
      const c = diatonicAt(o, key, sev);
      if (!c || c.triad === "diminished" && !(off === 7 && o === 11)) continue;
      const a = analyseChord(c, key);
      if (a.function !== curA.function) continue;
      out.push({ chords: [c], rules: ["diatonic-substitute"], detail: m("rh.diatSub", { a: a.roman, b: curA.roman, fn: FUNCTION_WORD[a.function] ?? m("fnw.same") }) });
    }
  }

  if (next && nextA && approachable(next, key)) {
    const target = next.root;
    const targetName = bareNumeral(nextA.roman);
    // 2. Secondary dominant (or the plain dominant before the tonic).
    const dom = relChord(next, 4, 7, "7", key);
    if (dom.root !== cur.root || !isDominantSeventh(cur)) {
      const toTonic = mod12(target - key.tonic) === 0;
      out.push({
        chords: [dom],
        rules: ["secondary-dominant"],
        detail: toTonic ? m("rh.secdom.tonic", { n: next.symbol }) : m("rh.secdom.target", { t: targetName, n: next.symbol }),
      });
    }
    // 3. ii–V insertion (needs at least 2 beats so each chord gets one).
    if (duration >= 2) {
      const ii = relChord(next, 1, 2, next.triad === "minor" ? "m7b5" : "m7", key);
      out.push({ chords: [ii, dom], rules: ["ii-v"], detail: m("rh.iiv", { n: next.symbol }) });
    }
    // 4. Tritone substitution of the (applied) dominant.
    const sub = relChord(next, 1, 1, "7", key);
    if (sub.root !== cur.root) {
      const curIsDominant = (cur.triad === "major" && mod12(cur.root - target) === 7);
      out.push({
        chords: [sub],
        rules: curIsDominant ? ["tritone-substitution"] : ["secondary-dominant", "tritone-substitution"],
        detail: curIsDominant
          ? m("rh.tritone.cur", { s: sub.symbol, c: cur.symbol, n: next.symbol })
          : m("rh.tritone.sec", { n: next.symbol }),
      });
    }
    // 6. Passing diminished between chords a whole step apart (ascending).
    if (duration >= 2 && mod12(next.root - cur.root) === 2) {
      const dim = relChord(next, -1, -1, "dim7", key);
      out.push({ chords: [cur, dim], rules: ["passing-diminished"], detail: m("rh.passdim", { d: dim.symbol, a: cur.rootName, b: next.rootName }) });
    }
  }

  // 5. Modal mixture.
  if (curA.category === "diatonic") {
    const borrow: [number, string, string][] = key.mode === "major"
      ? [[5, sev ? "m7" : "m", "iv"], [9, sev ? "maj7" : "maj", "bVI"], [4, sev ? "maj7" : "maj", "bIII"], [2, "m7b5", "iiø7"], [7, sev ? "7" : "maj", "bVII"]]
      : [[5, sev ? "7" : "maj", "IV"], [7, sev ? "7" : "maj", "V"]];
    for (const [from, quality, label] of borrow) {
      if (off !== from) continue;
      let root = cur.root;
      if (key.mode === "major" && from === 9) root = mod12(key.tonic + 8);
      if (key.mode === "major" && from === 4) root = mod12(key.tonic + 3);
      if (key.mode === "major" && from === 7) {
        if (!next || offsetOf(next, key) !== 0) continue; // backdoor bVII only before the tonic
        root = mod12(key.tonic + 10);
      }
      if (key.mode === "minor" && from === 7 && cur.triad === "major") continue;
      const c = makeChord(root, quality, key);
      if (c.symbol === cur.symbol) continue;
      out.push({ chords: [c], rules: ["modal-mixture"], detail: m("rh.mixture", { label, mode: m(key.mode === "major" ? "rh.mixture.minor" : "rh.mixture.major") }) });
    }
    if (key.mode === "minor" && off === 0 && isLast) {
      out.push({ chords: [makeChord(cur.root, "maj", key)], rules: ["modal-mixture"], detail: m("rh.picardy") });
    }
  }

  // 7. Deceptive resolution: after V, replace the tonic by vi (or bVI / VI).
  if (prev && off === 0 && isDominantOfTonic(prev, key) && (cur.triad === "major" || cur.triad === "minor")) {
    if (key.mode === "major") {
      out.push({ chords: [diatonicAt(9, key, sev)!], rules: ["deceptive-resolution"], detail: m("rh.deceptive.vi", { p: prev.symbol }) });
      out.push({ chords: [makeChord(mod12(key.tonic + 8), sev ? "maj7" : "maj", key)], rules: ["deceptive-resolution", "modal-mixture"], detail: m("rh.deceptive.bVI", { p: prev.symbol }) });
    } else {
      out.push({ chords: [diatonicAt(8, key, sev)!], rules: ["deceptive-resolution"], detail: m("rh.deceptive.VI", { p: prev.symbol }) });
    }
  }

  // Deduplicate by symbols and drop no-ops (first option wins, so advanced labels take precedence).
  const seen = new Set<string>([cur.symbol]);
  return out.filter((o) => {
    const sig = o.chords.map((c) => c.symbol).join(" ");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/** v2 rules. They aim at the following chord, so (right-to-left search) the target is always real. */
function advancedOptions(cur: Chord, next: Chord | undefined, key: Key, duration: number, isLast: boolean): Option[] {
  const out: Option[] = [];
  const off = offsetOf(cur, key);
  const nextOff = next ? offsetOf(next, key) : undefined;
  const sp = (o: number) => spellInKey(mod12(key.tonic + o), key);
  if (next && nextOff === 7 && (next.triad === "major" || next.triad === "sus4") && cur.root !== mod12(key.tonic + 8)) {
    // Augmented sixth (German, pop spelling bVI7) and Neapolitan sixth before V.
    const ger = relChord(next, 1, 1, "7", key);
    out.push({ chords: [ger], rules: ["augmented-sixth"], detail: m("rh.aug6", { g: ger.symbol, b6: sp(8), s4: sp(6), five: sp(7) }) });
    const n6 = makeChord(mod12(key.tonic + 1), "maj", key, mod12(key.tonic + 5));
    out.push({ chords: [n6], rules: ["neapolitan-approach"], detail: m("rh.n6", { n: n6.symbol, b2: sp(1), lt: sp(11) }) });
  }
  if (key.mode === "major" && next && nextOff === 0 && (next.triad === "major") && duration >= 2 && off !== 7) {
    // Backdoor ii–V: iv7 – bVII7 – I.
    const iv = makeChord(mod12(key.tonic + 5), "m7", key);
    const b7 = makeChord(mod12(key.tonic + 10), "7", key);
    out.push({ chords: [iv, b7], rules: ["backdoor-ii-v"], detail: m("rh.backdoor", { iv: iv.symbol, b7: b7.symbol, n: next.symbol }) });
  }
  if (!isLast && (cur.triad === "major" || cur.triad === "minor") && (off === 0 || (key.mode === "major" && off === 9))) {
    // Chromatic mediants of a tonic-function chord: major triads a third away that are not diatonic.
    for (const d of [4, 9]) {
      const root = mod12(cur.root + d);
      const c = makeChord(root, "maj", key);
      if (c.symbol === cur.symbol) continue;
      if (next && mod12(next.root - root) === 5) continue; // that would be an applied dominant, not a mediant
      out.push({ chords: [c], rules: ["chromatic-mediant"], detail: m("rh.mediant", { c: c.symbol, x: cur.symbol }) });
    }
  }
  return out;
}

/* ---------- scoring ---------- */

/** Symmetric average nearest-pitch-class distance (semitones) between two chords. */
export function voiceLeadingDistance(a: Chord, b: Chord): number {
  const near = (x: number, set: number[]) => Math.min(...set.map((y) => Math.min(mod12(x - y), mod12(y - x))));
  const ab = b.pcs.reduce((s, x) => s + near(x, a.pcs), 0) / b.pcs.length;
  const ba = a.pcs.reduce((s, x) => s + near(x, b.pcs), 0) / a.pcs.length;
  return (ab + ba) / 2;
}

interface Slotted {
  items: ProgressionItem[];
  slotOf: number[]; // flat index → slot
}

function flatten(slots: Chord[][], original: ProgressionItem[], from: number): Slotted {
  const items: ProgressionItem[] = [];
  const slotOf: number[] = [];
  slots.forEach((chords, k) => {
    const slot = from + k;
    const o = original[slot];
    for (const c of chords) {
      items.push({ chord: c, duration: o.duration / chords.length, bar: o.bar });
      slotOf.push(slot);
    }
  });
  return { items, slotOf };
}

function scoreSequence(
  s: Slotted, key: Key, target: number[], from: number, nSlots: number, w: Weights, changes: number, prevChord?: Chord, regionKeys?: Key[],
): { slotCurve: number[]; curveDistance: number; voiceLeading: number; score: number } {
  // Prepend the (original) previous chord so the first chord's sequential term is available, then drop it.
  const withPrev = prevChord ? [{ chord: prevChord, duration: 1, bar: 0 }, ...s.items] : s.items;
  const an = analyseProgression(withPrev, key);
  const rk = regionKeys ? [...(prevChord ? [regionKeys[from - 1]] : []), ...s.slotOf.map((slot) => regionKeys[slot])] : undefined;
  const curve = tensionCurve(withPrev, key, an, rk).slice(prevChord ? 1 : 0);
  const sums = new Array(nSlots).fill(0);
  const durs = new Array(nSlots).fill(0);
  s.items.forEach((it, idx) => {
    const k = s.slotOf[idx] - from;
    sums[k] += curve[idx].total * it.duration;
    durs[k] += it.duration;
  });
  const slotCurve = sums.map((v, k) => v / durs[k]);
  const se = slotCurve.reduce((acc, v, k) => acc + (v - target[from + k]) ** 2, 0);
  const curveDistance = Math.sqrt(se / nSlots);
  let vl = 0;
  for (let i = 1; i < s.items.length; i++) vl += voiceLeadingDistance(s.items[i - 1].chord, s.items[i].chord);
  const voiceLeading = s.items.length > 1 ? vl / (s.items.length - 1) : 0;
  return { slotCurve, curveDistance, voiceLeading, score: w.curve * curveDistance + w.voiceLeading * voiceLeading + w.change * changes };
}

/* ---------- search ---------- */

interface State {
  slots: Chord[][]; // for slots i..N-1
  picks: Option[];
  changes: number;
  score: number;
}

export function reharmonise(opts: ReharmOptions): ReharmResult {
  const { items, key, target } = opts;
  const n = items.length;
  const locked = opts.locked ?? new Array(n).fill(false);
  const w: Weights = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const beamWidth = opts.beamWidth ?? 48;
  const maxResults = opts.maxResults ?? 5;
  if (target.length !== n) throw new Error("target curve must have one value per chord");

  const rk = opts.regionKeys;
  const original = scoreSequence(flatten(items.map((it) => [it.chord]), items, 0), key, target, 0, n, w, 0, undefined, rk);
  if (n === 0) return { original, suggestions: [], message: fmtEn(m("rh.empty")), messageMsg: m("rh.empty") };

  let beam: State[] = [{ slots: [], picks: [], changes: 0, score: 0 }];
  for (let i = n - 1; i >= 0; i--) {
    const cur = items[i].chord;
    const prev = i > 0 ? items[i - 1].chord : undefined;
    const expanded: State[] = [];
    const seen = new Set<string>();
    for (const st of beam) {
      const next = st.slots[0]?.[0];
      const options: Option[] = [{ chords: [cur], rules: [], detail: "" }];
      if (!locked[i]) options.push(...generateOptions(cur, next, prev, key, items[i].duration, i === n - 1, opts.advancedRules));
      for (const op of options) {
        const slots = [op.chords, ...st.slots];
        const sig = slots.map((cs) => cs.map((c) => c.symbol).join(",")).join("|");
        if (seen.has(sig)) continue;
        seen.add(sig);
        const changes = st.changes + (op.rules.length ? 1 : 0);
        const sc = scoreSequence(flatten(slots, items, i), key, target, i, n - i, w, changes, prev, rk);
        expanded.push({ slots, picks: [op, ...st.picks], changes, score: sc.score });
      }
    }
    expanded.sort((a, b) => a.score - b.score);
    beam = expanded.slice(0, beamWidth);
  }

  const suggestions: Suggestion[] = [];
  for (const st of beam) {
    if (st.changes === 0) continue;
    const flat = flatten(st.slots, items, 0);
    // Re-verify context-dependent rules on the final sequence.
    let valid = true;
    st.picks.forEach((op, slot) => {
      if (op.rules.includes("deceptive-resolution")) {
        const before = slot > 0 ? st.slots[slot - 1][st.slots[slot - 1].length - 1] : undefined;
        if (!before || !isDominantOfTonic(before, key)) valid = false;
      }
    });
    // A change must not create an immediate repeat of the same chord.
    for (let i = 1; i < flat.items.length && valid; i++) {
      const a = flat.items[i - 1], b = flat.items[i];
      const changedA = st.picks[flat.slotOf[i - 1]].rules.length > 0;
      const changedB = st.picks[flat.slotOf[i]].rules.length > 0;
      if ((changedA || changedB) && a.chord.symbol === b.chord.symbol) valid = false;
    }
    if (!valid) continue;
    const sc = scoreSequence(flat, key, target, 0, n, w, st.changes, undefined, rk);
    if (sc.curveDistance > original.curveDistance + 1e-9) continue;
    const changes: Change[] = [];
    st.picks.forEach((op, slot) => {
      if (!op.rules.length) return;
      const from = items[slot].chord.symbol;
      const to = op.chords.map((c) => c.symbol);
      const verb = op.rules.includes("passing-diminished") ? m("rh.verb.insert", { d: to[1], from }) : m("rh.verb.replace", { to: to.join("–"), from });
      const textMsg = m("rh.change", { slot: slot + 1, verb, rules: op.rules.map((r) => m(`rule.${r}` as Msg["k"])), detail: op.detail || "" });
      changes.push({ slot, rules: op.rules, from, to, text: fmtEn(textMsg), textMsg });
    });
    suggestions.push({
      items: flat.items,
      changes,
      slotCurve: sc.slotCurve,
      curveDistance: sc.curveDistance,
      voiceLeading: sc.voiceLeading,
      score: sc.score,
      summary: changes.map((c) => c.text).join(" "),
    });
  }
  suggestions.sort((a, b) => a.score - b.score);
  const top = suggestions.slice(0, maxResults);
  return {
    original,
    suggestions: top,
    message: top.length ? undefined : fmtEn(m("rh.none")),
    messageMsg: top.length ? undefined : m("rh.none"),
  };
}

/* ---------- target presets ---------- */

export type TargetPreset = "arch" | "tenser" | "calmer" | "flat";

/** Build a target curve from the original slot curve. First and last points are kept. */
export function presetTarget(curve: number[], preset: TargetPreset): number[] {
  const n = curve.length;
  return curve.map((v, i) => {
    if (n > 2 && (i === 0 || i === n - 1)) return v;
    switch (preset) {
      case "arch": return v + 4 * Math.sin((Math.PI * (i + 0.5)) / n);
      case "tenser": return v + 3;
      case "calmer": return Math.max(0, v * 0.6);
      case "flat": return curve.reduce((s, x) => s + x, 0) / n;
    }
  });
}
