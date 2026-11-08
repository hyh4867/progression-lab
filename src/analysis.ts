/**
 * Harmonic analysis (v2): Roman numerals, one harmonic function per chord (T / PD / D / PASS — never
 * "unknown"), the harmonic device that explains the chord, alternative readings and a plain-English
 * explanation. Numerals are relative to the key's own scale (major scale / natural minor); in minor keys
 * the harmonic-minor V and vii° are diatonic and shown without an accidental.
 *
 * Classification uses the chord's core (root, third, fifth, seventh): extensions and alterations
 * (9, 11, 13, b9, #9, #11, b13, 6) never change the function, they only add the "altered dominant" tag.
 */
import { isDominantSeventh, type Chord } from "./chord";
import { MAJOR_SCALE, NATURAL_MINOR_SCALE, degreeOfOffset, scaleOf, spellInKey, type Key } from "./key";
import { mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";
import { fmtEn, m, type Msg } from "./i18n";

/** A message, or plain notation that is the same in every language (e.g. "Ger+6", "subV"). */
export type Txt = Msg | string;

/** Language-neutral texts of an analysis; render with fmt(lang, …). */
export interface AnalysisTexts {
  deviceName: Txt;
  chip: Txt;
  reason: Txt;
  explanation: Txt;
  alternatives: Txt[];
}

export type HarmonicFunction = "T" | "PD" | "D" | "PASS";
export const FUNCTION_NAMES: Record<HarmonicFunction, string> = {
  T: "Tonic",
  PD: "Predominant",
  D: "Dominant",
  PASS: "Passing / embellishing",
};

export type ChordCategory =
  | "diatonic"
  | "secondary-dominant"
  | "secondary-leading-tone"
  | "tritone-sub"
  | "neapolitan"
  | "borrowed"
  | "blues-dominant"
  | "augmented-sixth"
  | "augmented"
  | "diminished"
  | "chromatic-mediant"
  | "chromatic";

export const CATEGORY_NAMES: Record<ChordCategory, string> = {
  diatonic: "Diatonic",
  "secondary-dominant": "Secondary dominant",
  "secondary-leading-tone": "Secondary leading-tone chord",
  "tritone-sub": "Tritone substitution",
  neapolitan: "Neapolitan",
  borrowed: "Borrowed (modal interchange)",
  "blues-dominant": "Blues dominant",
  "augmented-sixth": "Augmented sixth",
  augmented: "Augmented triad",
  diminished: "Diminished seventh",
  "chromatic-mediant": "Chromatic mediant",
  chromatic: "Chromatic (function inferred)",
};

export type ModeName = "ionian" | "dorian" | "phrygian" | "lydian" | "mixolydian" | "aeolian" | "harmonic-minor" | "melodic-minor";

export const MODE_NAMES: Record<ModeName, string> = {
  ionian: "Ionian (parallel major)",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
  aeolian: "Aeolian (parallel minor)",
  "harmonic-minor": "harmonic minor",
  "melodic-minor": "melodic minor",
};

const MODE_SCALES: Record<ModeName, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
  "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
};

export interface ChordAnalysis {
  roman: string; // full display, e.g. "V7/ii", "bVII", "ii65", "Ger+6"
  numeral: string; // numeral with accidental and quality, without inversion
  figure: string; // inversion figure ("6", "64", "65", "43", "42", "/^5") or ""
  rootOffset: number; // analysed root relative to tonic, 0..11 (symmetric chords may be re-rooted)
  function: HarmonicFunction;
  /** True when no device explains the chord and the function was inferred from its root degree. */
  inferred: boolean;
  category: ChordCategory;
  /** Primary device id (e.g. "aug6-ger", "ct-dim7", "mixture"). */
  device: string;
  /** Human-readable device name (e.g. "German augmented sixth"). */
  deviceName: string;
  /** Short chip text for the UI (e.g. "Ger+6", "ct°7", "from Aeolian"); "" for plain diatonic chords. */
  chip: string;
  /** Every device tag that applies (primary device, "mixture:<mode>", "altered-dominant", "passing-dim", ...). */
  tags: string[];
  /** Source mode for modal interchange. */
  mode?: ModeName;
  /** Short reason for the function label. */
  reason: string;
  /** 1–2 plain-English sentences: what it is, how it resolves, the voice-leading. */
  explanation: string;
  /** Other valid readings (e.g. "= tritone substitute of V/V"). */
  alternatives: string[];
  /** The same texts as messages, for other languages. */
  texts: AnalysisTexts;
  /** For applied chords: offset of the chord they point to. */
  targetOffset?: number;
  resolves?: boolean;
}

export type CadenceType = "authentic" | "plagal" | "half" | "deceptive";

export interface Cadence {
  type: CadenceType;
  at: number; // index of the arrival chord
  description: string;
  descriptionMsg: Msg;
}

/** Progression-level context that some readings depend on. */
export interface AnalysisContext {
  /** The progression contains a chord with b3 or b6 over the tonic (minor-mode colour). */
  minorColour: boolean;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const PLAIN_QUALITIES = new Set(["maj", "m", "dim", "aug", "7", "maj7", "m7", "m7b5", "dim7"]);
const IT6 = [0, 6, 8];
const FR6 = [0, 2, 6, 8];
const GER6 = [0, 3, 6, 8];

/* ---------------- helpers ---------------- */

function subset(xs: number[], set: number[]): boolean {
  return xs.every((x) => set.includes(x));
}

function sameSet(xs: number[], ys: number[]): boolean {
  const a = [...new Set(xs)].sort((p, q) => p - q);
  const b = [...new Set(ys)].sort((p, q) => p - q);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Core pitch classes: root, third (or sus tone), fifth and seventh. */
export function corePcs(chord: Chord): number[] {
  return [...new Set(chord.tones.filter((t) => t.role === "root" || t.role === "third" || t.role === "fifth" || t.role === "seventh").map((t) => mod12(chord.root + t.interval)))];
}

function coreOffsets(chord: Chord, key: Key): number[] {
  return corePcs(chord).map((pc) => mod12(pc - key.tonic));
}

function alterations(chord: Chord): string[] {
  const alts = chord.tones.filter((t) => ["b9", "#9", "#11", "b13"].includes(t.label)).map((t) => t.label);
  const fifth = chord.tones.find((t) => t.role === "fifth");
  if (fifth && fifth.label !== "5" && chord.triad !== "diminished") alts.push(fifth.label);
  return alts;
}

/** Degree + accidental relative to a scale. */
function degreeAndAccidental(offset: number, scale: number[]): { degree: number; acc: string } {
  const degree = degreeOfOffset(offset);
  let diff = mod12(offset - scale[degree]);
  if (diff > 6) diff -= 12;
  return { degree, acc: diff < 0 ? "b".repeat(-diff) : "#".repeat(diff) };
}

function isLowercase(chord: Chord): boolean {
  return chord.triad === "minor" || chord.triad === "diminished";
}

/** Quality suffix for Roman numerals ("7", "maj7", "°", "ø7", "+", "sus4", "add9", ...). */
export function romanQualitySuffix(chord: Chord): string {
  // Added-sixth chords are written "add6" so they cannot be confused with the first-inversion figure "6".
  const q = chord.quality.replace(/^(m?)6\/9/, "$1add6(9)").replace(/^(m?)6/, "$1add6");
  if (q === "maj" || q === "m") return "";
  if (q === "dim") return "°";
  if (q.startsWith("dim7")) return "°7" + q.slice(4);
  if (q.startsWith("m7b5")) return "ø7" + q.slice(4);
  if (q === "aug") return "+";
  if (q.startsWith("aug")) return "+" + q.slice(3);
  if (q.startsWith("mMaj")) return "maj" + q.slice(4);
  if (q.startsWith("m") && !q.startsWith("maj")) return q.slice(1);
  return q;
}

function numeralFor(degree: number, chord: Chord): string {
  const n = NUMERALS[degree];
  return (isLowercase(chord) ? n.toLowerCase() : n) + romanQualitySuffix(chord);
}

function figureFor(chord: Chord, key: Key): string {
  if (!chord.hasSlash) return "";
  const interval = mod12(chord.bass - chord.root);
  const tone = chord.tones.find((t) => t.interval === interval);
  const seventh = chord.seventh !== "none";
  if (tone && PLAIN_QUALITIES.has(chord.quality)) {
    if (tone.role === "third") return seventh ? "65" : "6";
    if (tone.role === "fifth") return seventh ? "43" : "64";
    if (tone.role === "seventh") return "42";
  }
  const bassOffset = mod12(chord.bass - key.tonic);
  const { degree, acc } = degreeAndAccidental(bassOffset, scaleOf(key));
  return "/^" + acc + (degree + 1);
}

/** Insert an inversion figure: "V7/ii" + "65" → "V65/ii"; seventh figures replace the "7". */
function withFigure(numeral: string, figure: string): string {
  if (!figure || figure.startsWith("/^")) return numeral + figure;
  if (/[+]6$/.test(numeral) || numeral.startsWith("N") || numeral.startsWith("ct")) return numeral;
  const slash = numeral.indexOf("/");
  let head = slash >= 0 ? numeral.slice(0, slash) : numeral;
  const tail = slash >= 0 ? numeral.slice(slash) : "";
  if (figure === "65" || figure === "43" || figure === "42") head = head.replace(/7$/, "");
  return head + figure + tail;
}

/** Diatonic function of a root offset. */
function functionOfOffset(offset: number, key: Key, chord: Chord): HarmonicFunction {
  if (key.mode === "major") {
    const table: Record<number, HarmonicFunction> = { 0: "T", 1: "PD", 2: "PD", 3: "T", 4: "T", 5: "PD", 6: "PD", 7: "D", 8: "PD", 9: "T", 10: "D", 11: "D" };
    return table[offset];
  }
  const table: Record<number, HarmonicFunction> = { 0: "T", 1: "PD", 2: "PD", 3: "T", 4: "T", 5: "PD", 6: "PD", 7: "D", 8: "T", 9: chord.triad === "diminished" ? "D" : "PD", 10: "D", 11: "D" };
  return table[offset];
}

/**
 * Fallback inference from the root degree (T: I, iii, vi / i, bIII; PD: ii, IV, iv, bII, bVI; D: V, vii°).
 * bVI counts as a tonic substitute only directly after a dominant (deceptive); #iv/bV is read as PD.
 */
function inferFunction(offset: number, prevA?: { function: HarmonicFunction }): HarmonicFunction {
  if (offset === 8) return prevA?.function === "D" ? "T" : "PD";
  const table: Record<number, HarmonicFunction> = { 0: "T", 1: "PD", 2: "PD", 3: "T", 4: "T", 5: "PD", 6: "PD", 7: "D", 9: "T", 10: "D", 11: "D" };
  return table[offset];
}

/** Offsets of diatonic chords that can be tonicised (major or minor triads, excluding the tonic). */
function tonicisableTargets(key: Key): Map<number, string> {
  const m = new Map<number, string>();
  if (key.mode === "major") {
    m.set(2, "ii"); m.set(4, "iii"); m.set(5, "IV"); m.set(7, "V"); m.set(9, "vi");
  } else {
    m.set(3, "III"); m.set(5, "iv"); m.set(7, "V"); m.set(8, "VI"); m.set(10, "VII");
  }
  return m;
}

function isDominantQuality(chord: Chord): boolean {
  return (chord.triad === "major" || chord.triad === "augmented") && (chord.seventh === "none" || chord.seventh === "minor7");
}

function isCoreDiatonic(chord: Chord, key: Key): boolean {
  const offs = coreOffsets(chord, key);
  if (key.mode === "major") return subset(offs, MAJOR_SCALE);
  const rootOff = mod12(chord.root - key.tonic);
  if (subset(offs, NATURAL_MINOR_SCALE)) return true;
  if (rootOff === 0 && chord.triad === "minor" && subset(offs, MODE_SCALES["melodic-minor"])) return true; // i(maj7)
  return (rootOff === 7 || rootOff === 11) && subset(offs, MODE_SCALES["harmonic-minor"]);
}

/** Modes searched for modal interchange, in order of preference. */
function mixtureOrder(key: Key, ctx: AnalysisContext): ModeName[] {
  if (key.mode === "minor") return ["dorian", "ionian", "phrygian", "mixolydian", "lydian"];
  return ctx.minorColour
    ? ["aeolian", "mixolydian", "dorian", "lydian", "phrygian"]
    : ["mixolydian", "lydian", "aeolian", "dorian", "phrygian"];
}

const FNW: Record<HarmonicFunction, Msg> = { T: m("fnw.T"), PD: m("fnw.PD"), D: m("fnw.D"), PASS: m("fnw.PASS") };
const modeFull = (mode: ModeName) => m(`mode.${mode}.full` as Msg["k"]);
const modeShort = (mode: ModeName) => m(`mode.${mode}.short` as Msg["k"]);

/* ---------------- main classifier ---------------- */

export interface ChordContext {
  next?: Chord;
  prev?: Chord;
  prevAnalysis?: ChordAnalysis;
  ctx?: AnalysisContext;
}

/** Analyse one chord. `next`/`prev` refine the reading (resolutions, passing motion). */
export function analyseChord(chord: Chord, key: Key, next?: Chord, prevOrCtx?: Chord | ChordContext): ChordAnalysis {
  const c: ChordContext = prevOrCtx && "tones" in prevOrCtx ? { prev: prevOrCtx } : (prevOrCtx as ChordContext | undefined) ?? {};
  return classify(chord, key, { ...c, next });
}

function classify(chord: Chord, key: Key, cx: ChordContext): ChordAnalysis {
  const { next, prev } = cx;
  const ctx: AnalysisContext = cx.ctx ?? { minorColour: key.mode === "minor" };
  const scale = scaleOf(key);
  const sp = (offset: number) => spellInKey(mod12(key.tonic + offset), key);
  const writtenRoot = mod12(chord.root - key.tonic);
  const nextOffset = next ? mod12(next.root - key.tonic) : undefined;
  const prevOffset = prev ? mod12(prev.root - key.tonic) : undefined;
  const figure = figureFor(chord, key);
  const alts = alterations(chord);
  const targets = tonicisableTargets(key);
  const tonicName = key.mode === "major" ? "I" : "i";

  type MakeInput = Omit<Partial<ChordAnalysis>, "deviceName" | "chip" | "reason" | "explanation" | "alternatives" | "texts"> &
    Pick<ChordAnalysis, "numeral" | "function" | "category" | "device"> &
    { deviceName: Txt; reason: Txt; explanation: Txt; chip?: Txt; alternatives?: Txt[] };
  const make = (rootOffset: number, a: MakeInput): ChordAnalysis => {
    const tags = new Set<string>([a.device, ...(a.tags ?? [])]);
    if (a.mode) tags.add("mixture:" + a.mode);
    const fn = a.function;
    if (fn === "D" && alts.length && chord.seventh !== "none") tags.add("altered-dominant");
    if (fn === "D" && (chord.triad === "sus4" || chord.triad === "sus2")) tags.add("suspended-dominant");
    let chip: Txt = a.chip ?? "";
    if (tags.has("altered-dominant") && !chip) chip = m("an.chip.altered");
    if (tags.has("suspended-dominant") && !chip) chip = m("an.chip.sus");
    const alternatives = a.alternatives ?? [];
    return {
      roman: withFigure(a.numeral, figure),
      numeral: a.numeral,
      figure,
      rootOffset,
      function: fn,
      inferred: a.inferred ?? false,
      category: a.category,
      device: a.device,
      deviceName: fmtEn(a.deviceName),
      chip: fmtEn(chip),
      tags: [...tags],
      mode: a.mode,
      reason: fmtEn(a.reason),
      explanation: fmtEn(a.explanation),
      alternatives: alternatives.map(fmtEn),
      texts: { deviceName: a.deviceName, chip, reason: a.reason, explanation: a.explanation, alternatives },
      targetOffset: a.targetOffset,
      resolves: a.resolves,
    };
  };

  /** Target numeral of an applied chord follows the chord it actually resolves to (D7 → Gmaj7 in Eb: V7/III). */
  const targetNumeral = (offset: number, ch: Chord) => {
    const { degree, acc } = degreeAndAccidental(offset, scale);
    const n = NUMERALS[degree];
    return acc + (ch.triad === "minor" || ch.triad === "diminished" ? n.toLowerCase() : n);
  };

  const numeralAt = (offset: number) => {
    const { degree, acc } = degreeAndAccidental(offset, scale);
    return acc + numeralFor(degree, chord);
  };

  /* ---- 1. Augmented triads (symmetric: three possible roots) ---- */
  if (chord.triad === "augmented" && chord.seventh === "none") {
    const cands = [0, 4, 8].map((d) => mod12(writtenRoot + d));
    const spellings = cands.filter((o) => o !== writtenRoot).map((o) => sp(o) + "+");
    const alternatives = [m("an.aug.alt", { a: spellings[0], b: spellings[1] })];
    const vPlus = next ? cands.find((o) => mod12(nextOffset! - o) === 5) : undefined;
    // V–V+–I keeps its dominant reading; otherwise a #5 passing from a major chord on the same root is PASS.
    const passing = prev && prev.triad === "major" && prevOffset !== undefined && cands.includes(prevOffset) && next &&
      [0, 5, 9].includes(mod12(nextOffset! - prevOffset)) && !(prevOffset === 7 && nextOffset === 0);
    if (passing) {
      const r = prevOffset!;
      return make(r, {
        numeral: numeralAt(r),
        function: "PASS", category: "augmented", device: "passing-aug", deviceName: m("an.passingAug.name"), chip: m("an.passingAug.chip"),
        reason: m("an.passingAug.reason"), alternatives,
        explanation: m("an.passingAug.expl", { r: sp(r), f: sp(r + 7), sf: sp(r + 8), six: sp(r + 9) }),
      });
    }
    if (vPlus !== undefined) {
      const target = mod12(vPlus - 7);
      const toTonic = target === 0;
      const targetName = toTonic ? tonicName : next && (next.triad === "major" || next.triad === "minor") ? targetNumeral(target, next) : targets.get(target) ?? numeralAt(target);
      return make(vPlus, {
        numeral: toTonic ? "V+" : `V+/${targetName}`,
        function: "D", category: "augmented", device: "aug-dominant", deviceName: m("an.augDom.name"), chip: "V+",
        targetOffset: target, resolves: true, alternatives,
        reason: toTonic ? m("an.augDom.reasonTonic") : m("an.augDom.reasonTarget", { t: targetName }),
        explanation: m("an.augDom.expl", { v: sp(vPlus), tn: sp(target), sf: sp(vPlus + 8), third: sp(target + 4) }),
      });
    }
    if (key.mode === "minor" && cands.includes(3)) {
      return make(3, {
        numeral: "III+", function: "D", category: "augmented", device: "mediant-aug", deviceName: m("an.mediantAug.name"), chip: "III+",
        reason: m("an.mediantAug.reason"), alternatives,
        explanation: m("an.mediantAug.expl", { lt: sp(11) }),
      });
    }
    const fn = inferFunction(writtenRoot, cx.prevAnalysis);
    return make(writtenRoot, {
      numeral: numeralAt(writtenRoot), function: fn, inferred: true, category: "augmented", device: "inferred", deviceName: m("an.augInferred.name"), chip: m("an.chip.inferred"),
      reason: m("an.augInferred.reason", { fn: FNW[fn] }), alternatives,
      explanation: m("an.augInferred.expl"),
    });
  }

  /* ---- 2. Diminished sevenths (symmetric: four possible roots) ---- */
  if (chord.seventh === "diminished7") {
    const cands = [0, 3, 6, 9].map((d) => mod12(writtenRoot + d));
    const others = cands.filter((o) => o !== writtenRoot).map((o) => sp(o) + "°7");
    const alternatives = [m("an.dim7.alt", { list: others.join(", ") })];
    // Common-tone: the dim7 contains the root of the chord it embellishes (prev = next root).
    if (next && cands.includes(nextOffset!) && (prev === undefined || prevOffset === nextOffset)) {
      const r = writtenRoot;
      return make(r, {
        numeral: "ct°7", function: "PASS", category: "diminished", device: "ct-dim7", deviceName: m("an.ct.name"), chip: "ct°7",
        reason: m("an.ct.reason", { n: sp(nextOffset!) }), alternatives,
        explanation: m("an.ct.expl", { n: sp(nextOffset!) }),
      });
    }
    const lt = next ? cands.find((o) => mod12(nextOffset! - o) === 1) : undefined;
    if (lt !== undefined) {
      const target = nextOffset!;
      const passing = prev !== undefined && mod12(lt - prevOffset!) === 1;
      const toTonic = target === 0;
      const targetName = toTonic ? tonicName : next && (next.triad === "major" || next.triad === "minor") ? targetNumeral(target, next) : targets.get(target) ?? numeralAt(target).replace(/[^b#IViv]+$/, "");
      const tags = passing ? ["passing-dim"] : [];
      const passingAlt = passing ? [m("an.ltdim.passingAlt", { a: sp(prevOffset!), b: sp(lt), c: sp(target), deg: degreeOfOffset(prevOffset!) + 1 })] : [];
      return make(lt, {
        numeral: toTonic ? "vii°7" : `vii°7/${targetName}`,
        function: "D", category: toTonic ? (key.mode === "minor" ? "diatonic" : "borrowed") : "secondary-leading-tone",
        device: "leading-tone-dim7", deviceName: passing ? m("an.ltdim.namePassing") : m("an.ltdim.name"),
        chip: passing ? m("an.chip.passingDim") : toTonic ? "vii°7" : `vii°7/${targetName}`, tags,
        targetOffset: target, resolves: true, mode: toTonic && key.mode === "major" ? "harmonic-minor" : undefined,
        alternatives: [...passingAlt, ...alternatives],
        reason: m("an.ltdim.reason", { lt: sp(lt), t: sp(target) }),
        explanation: m("an.ltdim.expl", { lt: sp(lt), t: sp(target) }),
      });
    }
    // Descending passing diminished between chords a whole step apart.
    if (prev && next && mod12(prevOffset! - nextOffset!) === 2) {
      const between = mod12(nextOffset! + 1);
      if (cands.includes(between)) {
        return make(between, {
          numeral: numeralAt(between),
          function: "PASS", category: "diminished", device: "passing-dim", deviceName: m("an.passDim.name"), chip: m("an.chip.passingDim"), alternatives,
          reason: m("an.passDim.reason", { a: sp(prevOffset!), c: sp(nextOffset!) }),
          explanation: m("an.passDim.expl", { a: sp(prevOffset!), b: sp(between), c: sp(nextOffset!) }),
        });
      }
    }
    // No resolution in view: if one of its roots is the leading tone, read it as vii°7 of the tonic.
    if (cands.includes(11)) {
      return make(11, {
        numeral: "vii°7", function: "D", category: key.mode === "minor" ? "diatonic" : "borrowed", device: "leading-tone-dim7",
        deviceName: m("an.ltdim.name"), chip: "vii°7", targetOffset: 0, mode: key.mode === "major" ? "harmonic-minor" : undefined, alternatives,
        reason: m("an.ltdimTonic.reason", { lt: sp(11) }),
        explanation: m("an.ltdimTonic.expl", { lt: sp(11), t: sp(0) }),
      });
    }
    const fn = "D" as HarmonicFunction;
    return make(writtenRoot, {
      numeral: numeralAt(writtenRoot), function: fn, inferred: true, category: "diminished", device: "inferred", deviceName: m("an.dimInferred.name"), chip: m("an.chip.inferred"),
      reason: m("an.dimInferred.reason"), alternatives,
      explanation: m("an.dimInferred.expl"),
    });
  }

  /* ---- 3. Augmented sixths (pitch content + resolution to V or I6/4) ---- */
  const allOffsets = [...new Set([...chord.pcs, chord.bass].map((pc) => mod12(pc - key.tonic)))];
  const toV = next !== undefined && nextOffset === 7 && (next.triad === "major" || next.triad === "sus4");
  const toCad64 = next !== undefined && nextOffset === 0 && next.hasSlash && mod12(next.bass - key.tonic) === 7;
  if (toV || toCad64) {
    const kind = sameSet(allOffsets, GER6) ? "ger" : sameSet(allOffsets, FR6) ? "fr" : sameSet(allOffsets, IT6) ? "it" : null;
    if (kind) {
      const label = { it: "It+6", fr: "Fr+6", ger: "Ger+6" }[kind];
      const name = m(`an.aug6.${kind}.name` as Msg["k"]);
      const altName = m(`an.aug6.${kind}.alt` as Msg["k"], { b6: sp(8), two: sp(2) });
      return make(8, {
        numeral: label, function: "PD", category: "augmented-sixth", device: "aug6-" + kind, deviceName: name, chip: label,
        alternatives: [altName], targetOffset: 7, resolves: true,
        reason: m("an.aug6.reason"),
        explanation: m("an.aug6.expl", {
          name, b6: sp(8), s4: sp(6), five: sp(7),
          via: m(toCad64 ? "an.aug6.via" : "an.aug6.viaNone"),
          ger: m(kind === "ger" ? "an.aug6.gerNote" : "an.aug6.gerNone"),
        }),
      });
    }
  }

  /* ---- 4. Diatonic (core) ---- */
  if (isCoreDiatonic(chord, key)) {
    const { degree, acc } = degreeAndAccidental(writtenRoot, scale);
    const leading = key.mode === "minor" && (writtenRoot === 11 || writtenRoot === 7);
    const numeral = (leading ? "" : acc) + numeralFor(degree, chord);
    const fn = functionOfOffset(writtenRoot, key, chord);
    const altered = fn === "D" && alts.length > 0 && chord.seventh !== "none";
    const sus = chord.triad === "sus4" || chord.triad === "sus2";
    return make(writtenRoot, {
      numeral, function: fn, category: "diatonic", device: "diatonic", deviceName: altered ? m("an.diat.nameAltered") : sus && fn === "D" ? m("an.diat.nameSus") : m("an.diat.name"),
      reason: m("an.diat.reason", { num: numeral.replace(/[^b#IViv°ø+]/g, "") || numeral, fn: FNW[fn] }),
      explanation: altered
        ? m("an.diat.explAltered", { sym: chord.symbol, fn: FNW[fn], alts: alts.join(", ") })
        : sus && fn === "D"
          ? m("an.diat.explSus")
          : m("an.diat.expl", { num: numeral, fn: FNW[fn] }),
    });
  }

  /* ---- 5. Dorian IV in a minor key (unless it really acts as V of VII) ---- */
  if (key.mode === "minor" && writtenRoot === 5 && chord.triad === "major" && nextOffset !== 10) {
    return make(5, {
      numeral: "IV" + romanQualitySuffix(chord), function: "PD", category: "borrowed", device: "mixture", deviceName: m("an.mix.name", { mode: modeFull("dorian") }), chip: m("an.mix.chip", { mode: modeShort("dorian") }), mode: "dorian",
      reason: m("an.dorIV.reason"),
      explanation: m("an.dorIV.expl", { six: sp(9), t: sp(0) }),
    });
  }

  /* ---- 6. Secondary dominants (sevenths always; plain triads only when they resolve) ---- */
  const coreDominant = isDominantQuality(chord) || isDominantSeventh(chord);
  if (coreDominant) {
    const target = mod12(writtenRoot - 7);
    const mapped = targets.get(target);
    const hasSeventh = chord.seventh === "minor7";
    const resolves = nextOffset === target;
    const onTonic = writtenRoot === 0;
    // A dominant that really resolves a fifth down to a major or minor chord is V/x even when x is chromatic.
    // (Sevenths only: a plain major triad moving by fifth among borrowed chords, e.g. bVII → bIII, stays mixture.)
    const resolvesToTriad = resolves && hasSeventh && target !== 0 && !!next && (next.triad === "major" || next.triad === "minor");
    const targetName = resolvesToTriad ? targetNumeral(target, next!) : mapped;
    if (targetName && ((mapped && (resolves || (hasSeventh && !onTonic))) || resolvesToTriad)) {
      const numeral = "V" + romanQualitySuffix(chord) + "/" + targetName;
      return make(writtenRoot, {
        numeral, function: "D", category: "secondary-dominant", device: "secondary-dominant", deviceName: m("an.secdom.name"), chip: m("an.chip.appliedV"),
        targetOffset: target, resolves,
        reason: m("an.secdom.reason", { t: targetName }),
        explanation: m("an.secdom.expl", {
          sym: chord.symbol, t: targetName, tn: sp(target), th: sp(writtenRoot + 4),
          tail: next ? (resolves ? m("an.secdom.tailResolves", { tn: sp(target) }) : m("an.secdom.tailNot", { t: targetName })) : m("an.secdom.tailNone"),
        }),
      });
    }
  }

  /* ---- 7. Secondary leading-tone triads / half-diminished ---- */
  if (chord.triad === "diminished") {
    const target = mod12(writtenRoot + 1);
    const ltResolves = nextOffset === target && !!next && (next.triad === "major" || next.triad === "minor");
    const targetName = targets.get(target) ? (ltResolves ? targetNumeral(target, next!) : targets.get(target)) : undefined;
    if (targetName) {
      return make(writtenRoot, {
        numeral: "vii" + romanQualitySuffix(chord) + "/" + targetName, function: "D", category: "secondary-leading-tone", device: "secondary-leading-tone",
        deviceName: m("an.seclt.name"), chip: m("an.chip.appliedVii"), targetOffset: target, resolves: nextOffset === target,
        reason: m("an.seclt.reason", { r: sp(writtenRoot), t: targetName }),
        explanation: m("an.seclt.expl", { t: targetName, r: sp(writtenRoot), tn: sp(target) }),
      });
    }
  }

  /* ---- 8. Tritone substitution (must resolve down a half step) ---- */
  if (isDominantSeventh(chord)) {
    const target = mod12(writtenRoot - 1);
    const targetName = target === 0 ? tonicName : targets.get(target);
    if (targetName && (nextOffset === target || (target === 0 && nextOffset === undefined))) {
      return make(writtenRoot, {
        numeral: "subV" + romanQualitySuffix(chord) + (target === 0 ? "" : "/" + targetName), function: "D", category: "tritone-sub", device: "tritone-sub",
        deviceName: m("an.tritone.name"), chip: "subV", targetOffset: target, resolves: nextOffset === target,
        alternatives: [m("an.tritone.alt", { tgt: target === 0 ? "" : "/" + targetName, d: sp(target + 7), root: chord.rootName })],
        reason: m("an.tritone.reason", { t: targetName }),
        explanation: m("an.tritone.expl", { sym: chord.symbol, d: sp(target + 7), tn: sp(target) }),
      });
    }
  }

  /* ---- 9. Neapolitan / Phrygian bII ---- */
  if (writtenRoot === 1 && chord.triad === "major" && chord.seventh === "none") {
    const n6 = chord.hasSlash && mod12(chord.bass - key.tonic) === 5;
    const backToTonic = nextOffset === 0 && !n6;
    if (backToTonic) {
      return make(1, {
        numeral: "bII", function: "PD", category: "borrowed", device: "mixture", deviceName: m("an.mix.name", { mode: modeFull("phrygian") }), chip: m("an.mix.chip", { mode: modeShort("phrygian") }), mode: "phrygian",
        reason: m("an.phryg.reason"),
        explanation: m("an.phryg.expl", { t: sp(0), b2: sp(1) }),
      });
    }
    return make(1, {
      numeral: n6 ? "N6" : "N", function: "PD", category: "neapolitan", device: "neapolitan", deviceName: n6 ? m("an.neap.nameN6") : m("an.neap.name"), chip: n6 ? "N6" : "N",
      alternatives: ["= bII" + (n6 ? "6" : "")],
      reason: m("an.neap.reason"),
      explanation: m("an.neap.expl", { b2: sp(1), lt: sp(11), n6: m(n6 ? "an.neap.n6" : "an.neap.n6none") }),
    });
  }

  /* ---- 10. Backdoor dominant: bVII7 → I ---- */
  if (key.mode === "major" && writtenRoot === 10 && isDominantSeventh(chord) && (nextOffset === 0 || nextOffset === undefined)) {
    return make(10, {
      numeral: "bVII" + romanQualitySuffix(chord), function: "D", category: "borrowed", device: "backdoor-dominant", deviceName: m("an.backdoor.name"), chip: m("an.chip.backdoor"), mode: "aeolian",
      reason: m("an.backdoor.reason"),
      explanation: m("an.backdoor.expl", { sym: chord.symbol, b6: sp(8), five: sp(7), b7: sp(10), one: sp(0) }),
    });
  }

  /* ---- 11. Blues dominants: dominant sevenths on I / IV in a major key ---- */
  if (key.mode === "major" && isDominantSeventh(chord) && (writtenRoot === 0 || writtenRoot === 5)) {
    return make(writtenRoot, {
      numeral: (writtenRoot === 0 ? "I" : "IV") + romanQualitySuffix(chord), function: writtenRoot === 0 ? "T" : "PD", category: "blues-dominant", device: "blues-dominant",
      deviceName: m("an.blues.name"), chip: m("an.chip.blues"),
      reason: m(writtenRoot === 0 ? "an.blues.reasonTonic" : "an.blues.reasonIV"),
      explanation: m("an.blues.expl", { deg: writtenRoot === 0 ? "I" : "IV" }),
    });
  }

  /* ---- 12. Modal interchange (Picardy third included) ---- */
  const offs = coreOffsets(chord, key);
  for (const mode of mixtureOrder(key, ctx)) {
    if (!subset(offs, MODE_SCALES[mode])) continue;
    const numeral = numeralAt(writtenRoot);
    if (key.mode === "minor" && writtenRoot === 0 && (chord.triad === "major")) {
      return make(0, {
        numeral: "I" + romanQualitySuffix(chord), function: "T", category: "borrowed", device: "picardy", deviceName: m("an.picardy.name"), chip: m("an.chip.picardy"), mode: "ionian",
        reason: m("an.picardy.reason"),
        explanation: m("an.picardy.expl", { t: sp(0), b3: sp(3), three: sp(4) }),
      });
    }
    const fn = functionOfOffset(writtenRoot, key, chord);
    return make(writtenRoot, {
      numeral, function: fn, category: "borrowed", device: "mixture", deviceName: m("an.mix.name", { mode: modeFull(mode) }), chip: m("an.mix.chip", { mode: modeShort(mode) }), mode,
      reason: m("an.mix.reason", { num: numeral, t: sp(0), mode: modeShort(mode), fn: FNW[fn] }),
      explanation: m("an.mix.expl", { sym: chord.symbol, num: numeral, t: sp(0), mode: modeFull(mode) }),
    });
  }
  // Harmonic / melodic minor sources only for their characteristic chords.
  if (key.mode === "major" && (writtenRoot === 7 || writtenRoot === 11) && subset(offs, MODE_SCALES["harmonic-minor"])) {
    const fn = "D" as HarmonicFunction;
    return make(writtenRoot, {
      numeral: numeralAt(writtenRoot), function: fn, category: "borrowed", device: "mixture", deviceName: m("an.mix.name", { mode: modeFull("harmonic-minor") }), chip: m("an.mix.chip", { mode: modeShort("harmonic-minor") }), mode: "harmonic-minor",
      reason: m("an.harm.reason"),
      explanation: m("an.harm.expl", { t: sp(0), lt: sp(11), b6: sp(8), five: sp(7) }),
    });
  }

  /* ---- 13. Chromatic mediants: third-related chromatic triads ---- */
  if ((chord.triad === "major" || chord.triad === "minor") && [3, 4, 8, 9].includes(writtenRoot)) {
    return make(writtenRoot, {
      numeral: numeralAt(writtenRoot), function: "T", category: "chromatic-mediant", device: "chromatic-mediant", deviceName: m("an.mediant.name"), chip: m("an.chip.mediant"),
      reason: m("an.mediant.reason"),
      explanation: m("an.mediant.expl", { sym: chord.symbol }),
    });
  }

  /* ---- 14. Inferred from the root degree ---- */
  const fn = inferFunction(writtenRoot, cx.prevAnalysis);
  return make(writtenRoot, {
    numeral: numeralAt(writtenRoot), function: fn, inferred: true, category: "chromatic", device: "inferred", deviceName: m("an.inferred.name"), chip: m("an.chip.inferred"),
    reason: m("an.inferred.reason", { fn: FNW[fn] }),
    explanation: m("an.inferred.expl", { sym: chord.symbol, fn: FNW[fn] }),
  });
}

export function analysisContext(items: ProgressionItem[], key: Key): AnalysisContext {
  if (key.mode === "minor") return { minorColour: true };
  const minorColour = items.some((it) => coreOffsets(it.chord, key).some((o) => o === 3 || o === 8));
  return { minorColour };
}

export function analyseProgression(items: ProgressionItem[], key: Key): ChordAnalysis[] {
  const ctx = analysisContext(items, key);
  const out: ChordAnalysis[] = [];
  items.forEach((it, i) => {
    out.push(classify(it.chord, key, { next: items[i + 1]?.chord, prev: items[i - 1]?.chord, prevAnalysis: out[i - 1], ctx }));
  });
  return out;
}

function isTonicArrival(chord: Chord, a: ChordAnalysis): boolean {
  if (a.rootOffset !== 0 || !(chord.triad === "major" || chord.triad === "minor")) return false;
  return !(chord.hasSlash && mod12(chord.bass - chord.root) === 7);
}

function isDominantOfTonic(chord: Chord, a: ChordAnalysis): boolean {
  if (a.device === "aug-dominant" && a.targetOffset === 0) return true;
  if (a.category !== "diatonic" && !(a.device === "leading-tone-dim7" && a.targetOffset === 0) && !(a.category === "borrowed" && a.rootOffset === 11)) return false;
  if (a.rootOffset === 7) return chord.triad === "major" || chord.triad === "augmented";
  if (a.rootOffset === 11) return chord.triad === "diminished";
  return false;
}

function cad(type: CadenceType, at: number, descriptionMsg: Msg): Cadence {
  return { type, at, description: fmtEn(descriptionMsg), descriptionMsg };
}

export function detectCadences(items: ProgressionItem[], analyses: ChordAnalysis[]): Cadence[] {
  const out: Cadence[] = [];
  for (let i = 1; i < items.length; i++) {
    const p = items[i - 1].chord, c = items[i].chord;
    const pa = analyses[i - 1], ca = analyses[i];
    if (isDominantOfTonic(p, pa) && isTonicArrival(c, ca)) {
      const rootPos = !p.hasSlash && !c.hasSlash && pa.rootOffset === 7;
      out.push(cad("authentic", i, m("cad.authentic", { a: pa.roman, b: ca.roman, pos: m(rootPos ? "cad.authentic.root" : "cad.authentic.inv") })));
    } else if (pa.rootOffset === 5 && (pa.category === "diatonic" || pa.category === "borrowed" || pa.category === "blues-dominant") && (p.triad === "major" || p.triad === "minor") && isTonicArrival(c, ca)) {
      out.push(cad("plagal", i, m("cad.plagal", { a: pa.roman, b: ca.roman })));
    } else if (isDominantOfTonic(p, pa) && pa.rootOffset === 7 && (ca.rootOffset === 9 || ca.rootOffset === 8) && (c.triad === "major" || c.triad === "minor")) {
      out.push(cad("deceptive", i, m("cad.deceptive", { a: pa.roman, b: ca.roman })));
    }
  }
  const last = items.length - 1;
  if (last >= 1) {
    const c = items[last].chord, ca = analyses[last];
    if (ca.category === "diatonic" && ca.rootOffset === 7 && c.triad === "major") {
      out.push(cad("half", last, m("cad.half", { a: ca.roman })));
    }
  }
  return out;
}
