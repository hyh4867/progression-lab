/**
 * Chord-symbol parsing.
 *
 * Supported: major, m, 7, maj7, m7, m7b5 (ø), dim, dim7 (°7), aug (+), sus2, sus4, 6, m6, 6/9,
 * 9, add9, 11, 13, maj9, m9, m11, m13, mMaj7, 7sus4, 5 (power chord), alterations (b5 #5 b9 #9 #11 b13),
 * no3/no5, slash basses (C/E), sharps/flats (also ♯ ♭) and enharmonic roots.
 */
import { mod12, parseNotePrefix, type PitchClass } from "./pitch";
import { spellInKey, type Key } from "./key";
import { fmtEn, m as msg, type Msg } from "./i18n";

export type Triad = "major" | "minor" | "diminished" | "augmented" | "sus2" | "sus4" | "power";
export type Seventh = "none" | "minor7" | "major7" | "diminished7";
export type ToneRole = "root" | "third" | "fifth" | "sixth" | "seventh" | "ninth" | "eleventh" | "thirteenth";

export interface ChordTone {
  interval: number; // semitones above the root, 0..11
  role: ToneRole;
  label: string; // "1", "b3", "5", "b7", "b9", ...
  optional: boolean; // may be omitted in a voicing (e.g. the unaltered 5th)
}

export interface Chord {
  symbol: string; // normalised input symbol, e.g. "Bbmaj7/D"
  rootName: string;
  root: PitchClass;
  suffix: string; // suffix as written (after root, before slash)
  quality: string; // canonical quality, e.g. "maj", "m7", "7b9"
  triad: Triad;
  seventh: Seventh;
  tones: ChordTone[]; // sorted by interval
  pcs: PitchClass[]; // sorted, unique
  bass: PitchClass;
  bassName: string;
  hasSlash: boolean;
  /** Dissonant/added tones relative to the plain triad (labels), used by the tension model. */
  added: string[];
}

/** Parse error with a language-neutral message (render with fmt(lang, err.msg)); `message` is English. */
export class ChordParseError extends Error {
  msg: Msg;
  constructor(msg: Msg) {
    super(fmtEn(msg));
    this.msg = msg;
  }
}

interface Parsed {
  minor: boolean;
  dimTriad: boolean;
  aug: boolean;
  dim7: boolean;
  halfDim: boolean;
  majSeventh: boolean;
  ext: number; // 0, 5, 6, 7, 9, 11, 13
  sixNine: boolean;
  sus: 0 | 2 | 4;
  adds: number[]; // 9, 11, 13
  alts: string[]; // "b5", "#5", "b9", "#9", "#11", "b13"
  no3: boolean;
  no5: boolean;
}

function normaliseSuffix(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/♭/g, "b")
    .replace(/♯/g, "#")
    .replace(/−/g, "-")
    .replace(/ø7/g, "m7b5")
    .replace(/ø/g, "m7b5")
    .replace(/Δ7/g, "maj7")
    .replace(/Δ9/g, "maj9")
    .replace(/Δ13/g, "maj13")
    .replace(/Δ/g, "maj7")
    .replace(/°7/g, "dim7")
    .replace(/°/g, "dim");
}

function parseSuffix(input: string): Parsed {
  const p: Parsed = {
    minor: false, dimTriad: false, aug: false, dim7: false, halfDim: false, majSeventh: false,
    ext: 0, sixNine: false, sus: 0, adds: [], alts: [], no3: false, no5: false,
  };
  let s = normaliseSuffix(input);
  const eat = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(s);
    if (m && m.index === 0) {
      s = s.slice(m[0].length);
      return m;
    }
    return null;
  };

  // Head: chord family.
  if (eat(/^(m7b5|min7b5|mi7b5|-7b5|m7\(b5\)|-7\(b5\))/)) {
    p.halfDim = true; p.ext = 7;
  } else if (eat(/^(dim7|o7)/)) {
    p.dim7 = true; p.ext = 7;
  } else if (eat(/^(dim|o)/)) {
    p.dimTriad = true;
  } else if (eat(/^(aug|\+)/)) {
    p.aug = true;
  } else if (eat(/^(mMaj|mmaj|mM|minmaj|min\(maj|m\(maj|-maj|-M|m\(M)/)) {
    p.minor = true; p.majSeventh = true;
    const m = eat(/^(7|9|11|13)/);
    p.ext = m ? Number(m[1]) : 7;
    eat(/^\)/);
  } else if (/^(min|mi|m|-)(?!aj)/.test(s)) {
    eat(/^(min|mi|m|-)/);
    p.minor = true;
  }

  if (!p.majSeventh && !p.halfDim && !p.dim7) {
    // "maj7", "M7", "ma7", "maj" (alone = plain major triad)
    const mj = eat(/^(maj|Maj|MAJ|ma|M)(?=(7|9|11|13)|$|\(|\/|sus|add|#|b)/);
    if (mj) {
      const m = eat(/^(7|9|11|13)/);
      if (m) {
        p.majSeventh = true;
        p.ext = Number(m[1]);
      }
    }
  }

  if (p.ext === 0) {
    if (eat(/^(69|6\/9|6add9)/)) {
      p.sixNine = true; p.ext = 6;
    } else {
      const m = eat(/^(13|11|9|7|6|5)/);
      if (m) p.ext = Number(m[1]);
    }
  }

  // Tail: sus / add / alterations / omissions, optionally parenthesised or comma-separated.
  while (s.length > 0) {
    if (eat(/^[(),]/)) continue;
    if (eat(/^sus2/)) { p.sus = 2; continue; }
    if (eat(/^sus4?/)) { p.sus = 4; continue; }
    let m = eat(/^add(9|2|11|4|13|6)/);
    if (m) {
      const n = Number(m[1]);
      p.adds.push(n === 2 ? 9 : n === 4 ? 11 : n === 6 ? 13 : n);
      continue;
    }
    m = eat(/^(maj|M)(7|9|11|13)/);
    if (m) { p.majSeventh = true; p.ext = Math.max(p.ext, Number(m[2])); continue; }
    m = eat(/^(b|-)(5|9|13)/);
    if (m) { p.alts.push("b" + m[2]); continue; }
    m = eat(/^(#|\+)(5|9|11)/);
    if (m) { p.alts.push("#" + m[2]); continue; }
    if (eat(/^alt/)) { p.alts.push("b9", "#9", "b13"); if (p.ext < 7) p.ext = 7; continue; }
    if (eat(/^(no3|omit3)/)) { p.no3 = true; continue; }
    if (eat(/^(no5|omit5)/)) { p.no5 = true; continue; }
    if (eat(/^(9|11|13)/)) { continue; } // e.g. "7(9)" — tolerate as written colour
    throw new ChordParseError(msg("err.quality", { s: input }));
  }
  return p;
}

const ROLE_ORDER: ToneRole[] = ["root", "third", "fifth", "sixth", "seventh", "ninth", "eleventh", "thirteenth"];

function buildTones(p: Parsed): ChordTone[] {
  const tones: ChordTone[] = [{ interval: 0, role: "root", label: "1", optional: false }];
  const power = p.ext === 5 && !p.minor && !p.dimTriad && !p.aug;
  const minorThird = p.minor || p.dimTriad || p.dim7 || p.halfDim;
  const dominantEleven = p.ext === 11 && !p.minor && !p.majSeventh && !p.dimTriad && !p.halfDim;

  if (!power && !p.no3 && !dominantEleven) {
    if (p.sus === 2) tones.push({ interval: 2, role: "third", label: "2", optional: false });
    else if (p.sus === 4) tones.push({ interval: 5, role: "third", label: "4", optional: false });
    else tones.push({ interval: minorThird ? 3 : 4, role: "third", label: minorThird ? "b3" : "3", optional: false });
  }

  if (!p.no5) {
    let fifth = 7;
    let label = "5";
    if (p.dimTriad || p.dim7 || p.halfDim || p.alts.includes("b5")) { fifth = 6; label = "b5"; }
    if (p.aug || p.alts.includes("#5")) { fifth = 8; label = "#5"; }
    const optional = fifth === 7 && !power;
    tones.push({ interval: fifth, role: "fifth", label, optional });
  }

  if (p.ext === 6) tones.push({ interval: 9, role: "sixth", label: "6", optional: false });
  if (p.sixNine) tones.push({ interval: 2, role: "ninth", label: "9", optional: false });

  if (p.ext >= 7) {
    if (p.dim7) tones.push({ interval: 9, role: "seventh", label: "bb7", optional: false });
    else if (p.majSeventh) tones.push({ interval: 11, role: "seventh", label: "7", optional: false });
    else tones.push({ interval: 10, role: "seventh", label: "b7", optional: false });
  }
  if (p.ext >= 9 && !p.alts.includes("b9") && !p.alts.includes("#9")) {
    tones.push({ interval: 2, role: "ninth", label: "9", optional: p.ext > 9 });
  }
  if (p.ext >= 11 && (p.ext === 11 || p.minor) && !p.alts.includes("#11")) {
    tones.push({ interval: 5, role: "eleventh", label: "11", optional: p.ext > 11 });
  }
  if (p.ext >= 13 && !p.alts.includes("b13")) {
    tones.push({ interval: 9, role: "thirteenth", label: "13", optional: false });
  }
  for (const a of p.alts) {
    if (a === "b9") tones.push({ interval: 1, role: "ninth", label: "b9", optional: false });
    if (a === "#9") tones.push({ interval: 3, role: "ninth", label: "#9", optional: false });
    if (a === "#11") tones.push({ interval: 6, role: "eleventh", label: "#11", optional: false });
    if (a === "b13") tones.push({ interval: 8, role: "thirteenth", label: "b13", optional: false });
  }
  for (const a of p.adds) {
    if (a === 9) tones.push({ interval: 2, role: "ninth", label: "9", optional: false });
    if (a === 11) tones.push({ interval: 5, role: "eleventh", label: "11", optional: false });
    if (a === 13) tones.push({ interval: 9, role: "sixth", label: "6", optional: false });
  }

  // Deduplicate by interval, keeping the earliest (structural) role.
  const seen = new Map<number, ChordTone>();
  for (const t of tones) {
    const prev = seen.get(t.interval);
    if (!prev) seen.set(t.interval, t);
    else if (prev.optional && !t.optional) seen.set(t.interval, { ...prev, optional: false });
  }
  return [...seen.values()].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.interval - b.interval,
  );
}

function triadOf(tones: ChordTone[], p: Parsed): Triad {
  const third = tones.find((t) => t.role === "third");
  const fifth = tones.find((t) => t.role === "fifth");
  if (p.sus === 2) return "sus2";
  if (p.sus === 4) return "sus4";
  if (!third) return p.ext === 5 ? "power" : "major";
  if (third.interval === 3) return fifth?.interval === 6 ? "diminished" : "minor";
  return fifth?.interval === 8 ? "augmented" : "major";
}

function seventhOf(tones: ChordTone[]): Seventh {
  const s = tones.find((t) => t.role === "seventh");
  if (!s) return "none";
  return s.interval === 11 ? "major7" : s.interval === 9 ? "diminished7" : "minor7";
}

function canonicalQuality(p: Parsed, triad: Triad, seventh: Seventh): string {
  const altText = p.alts
    .filter((a) => !(a === "b5" && triad === "diminished"))
    .filter((a) => !(a === "#5" && triad === "augmented"))
    .join("");
  const addText = p.adds.map((a) => "add" + a).join("");
  const sus = triad === "sus2" ? "sus2" : triad === "sus4" ? "sus4" : "";
  const ext = p.ext >= 9 ? String(p.ext) : "7";
  if (seventh === "none") {
    if (p.sixNine) return (triad === "minor" ? "m" : "") + "6/9";
    if (p.ext === 6) return (triad === "minor" ? "m6" : "6") + sus + altText + addText;
    const base =
      triad === "minor" ? "m" : triad === "diminished" ? "dim" : triad === "augmented" ? "aug" :
      triad === "power" ? "5" : triad === "major" ? "" : sus;
    const q = base + altText + addText;
    return q === "" ? "maj" : q;
  }
  if (seventh === "diminished7") return "dim7" + altText + addText;
  if (triad === "diminished") return "m7b5" + altText + addText;
  if (seventh === "major7") return (triad === "minor" ? "mMaj" : "maj") + ext + sus + altText + addText;
  if (triad === "minor") return "m" + ext + altText + addText;
  if (triad === "augmented") return "aug" + ext + altText + addText;
  return ext + sus + altText + addText;
}

const ADDED_LABELS = new Set(["6", "b7", "7", "bb7", "9", "b9", "#9", "11", "#11", "13", "b13", "2", "4", "b5", "#5"]);

/** Parse a single chord symbol. Throws ChordParseError on unknown input. */
export function parseChord(input: string): Chord {
  const text = input.trim();
  if (!text) throw new ChordParseError(msg("err.empty"));
  const r = parseNotePrefix(text);
  if (!r) throw new ChordParseError(msg("err.noLetter", { s: text }));
  let body = text.slice(r.length);

  // Slash bass: the last "/" followed by a complete note name (so "6/9" is not a slash chord).
  let bassNote = r.note;
  let hasSlash = false;
  const slash = body.lastIndexOf("/");
  if (slash >= 0) {
    const b = parseNotePrefix(body.slice(slash + 1));
    if (b && b.length === body.length - slash - 1) {
      bassNote = b.note;
      hasSlash = true;
      body = body.slice(0, slash);
    }
  }
  const parsed = parseSuffix(body);
  const tones = buildTones(parsed);
  const triad = triadOf(tones, parsed);
  const seventh = seventhOf(tones);
  const root = r.note.pc;
  const pcs = [...new Set(tones.map((t) => mod12(root + t.interval)))].sort((a, b) => a - b);
  const bass = bassNote.pc;
  if (hasSlash && bass === root) hasSlash = false;
  return {
    symbol: r.note.text + body + (hasSlash ? "/" + bassNote.text : ""),
    rootName: r.note.text,
    root,
    suffix: body,
    quality: canonicalQuality(parsed, triad, seventh),
    triad,
    seventh,
    tones,
    pcs,
    bass,
    bassName: bassNote.text,
    hasSlash,
    added: tones.filter((t) => t.role !== "root" && t.role !== "third" && t.role !== "fifth" && ADDED_LABELS.has(t.label)).map((t) => t.label)
      .concat(tones.filter((t) => t.role === "fifth" && t.label !== "5" && triad !== "diminished" && triad !== "augmented").map((t) => t.label)),
  };
}

export function tryParseChord(input: string): Chord | null {
  try {
    return parseChord(input);
  } catch {
    return null;
  }
}

/** Display suffix for a canonical quality ("maj" is shown as an empty suffix). */
export function qualitySuffix(quality: string): string {
  return quality === "maj" ? "" : quality;
}

/** Build a chord from a root, canonical quality and optional bass, spelled to fit `key`. */
export function makeChord(root: PitchClass, quality: string, key: Key, bass?: PitchClass): Chord {
  const rootName = spellInKey(root, key);
  const bassPart = bass !== undefined && mod12(bass) !== mod12(root) ? "/" + spellInKey(bass, key) : "";
  return parseChord(rootName + qualitySuffix(quality) + bassPart);
}

/** Re-spell a chord for a key, keeping the written suffix. */
export function respell(chord: Chord, key: Key): Chord {
  const rootName = spellInKey(chord.root, key);
  const bassPart = chord.hasSlash ? "/" + spellInKey(chord.bass, key) : "";
  return parseChord(rootName + chord.suffix + bassPart);
}

/** Transpose by semitones; spelling chosen to fit `key` if given (otherwise the transposed key of nothing → sharps/flats by key). */
export function transposeChord(chord: Chord, semitones: number, key: Key): Chord {
  const rootName = spellInKey(mod12(chord.root + semitones), key);
  const bassPart = chord.hasSlash ? "/" + spellInKey(mod12(chord.bass + semitones), key) : "";
  return parseChord(rootName + chord.suffix + bassPart);
}

export function chordHasTone(chord: Chord, interval: number): boolean {
  return chord.tones.some((t) => t.interval === interval);
}

/** True for chords with dominant quality: major 3rd + minor 7th (7, 9, 13, 7b9, 7#9, 7sus4 excluded). */
export function isDominantSeventh(chord: Chord): boolean {
  return (chord.triad === "major" || chord.triad === "augmented") && chord.seventh === "minor7";
}
