/** Keys, scales and key-aware enharmonic spelling. */
import { FLAT_NAMES, SHARP_NAMES, letterOf, mod12, parseNotePrefix, spellWithLetter, type PitchClass } from "./pitch";

export type Mode = "major" | "minor";

export interface Key {
  tonic: PitchClass;
  mode: Mode;
}

/** Conventional tonic spellings (fewest accidentals; F# major and C# minor-side choices noted in docs). */
const MAJOR_TONIC_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_TONIC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function scaleOf(key: Key): number[] {
  return key.mode === "major" ? MAJOR_SCALE : NATURAL_MINOR_SCALE;
}

/** Diatonic pitch-class set of the key (natural minor for minor keys). */
export function diatonicSet(key: Key): PitchClass[] {
  return scaleOf(key).map((i) => mod12(key.tonic + i));
}

export function tonicName(key: Key): string {
  return (key.mode === "major" ? MAJOR_TONIC_NAMES : MINOR_TONIC_NAMES)[mod12(key.tonic)];
}

export function keyName(key: Key): string {
  return `${tonicName(key)} ${key.mode}`;
}

/** Short label: "C", "Am". */
export function keyShortName(key: Key): string {
  return tonicName(key) + (key.mode === "minor" ? "m" : "");
}

export function sameKey(a: Key, b: Key): boolean {
  return mod12(a.tonic) === mod12(b.tonic) && a.mode === b.mode;
}

export function transposeKey(key: Key, semitones: number): Key {
  return { tonic: mod12(key.tonic + semitones), mode: key.mode };
}

export function relativeKey(key: Key): Key {
  return key.mode === "major"
    ? { tonic: mod12(key.tonic - 3), mode: "minor" }
    : { tonic: mod12(key.tonic + 3), mode: "major" };
}

export function parallelKey(key: Key): Key {
  return { tonic: key.tonic, mode: key.mode === "major" ? "minor" : "major" };
}

/** Position on the circle of fifths of the key signature (C major / A minor = 0, sharps positive). */
export function signatureFifths(key: Key): number {
  const majorTonic = key.mode === "major" ? key.tonic : mod12(key.tonic + 3);
  let f = mod12(majorTonic * 7); // number of fifths up from C
  if (f > 6) f -= 12;
  return f;
}

/** Steps between two key signatures on the circle of fifths (0..6). */
export function signatureDistance(a: Key, b: Key): number {
  const d = Math.abs(signatureFifths(a) - signatureFifths(b)) % 12;
  return Math.min(d, 12 - d);
}

export function parseKey(text: string): Key | null {
  const s = text.trim();
  if (!s) return null;
  const head = s[0].toUpperCase() + s.slice(1);
  const r = parseNotePrefix(head);
  if (!r) return null;
  const rest = head.slice(r.length).trim().toLowerCase();
  let mode: Mode;
  if (rest === "") mode = s[0] === s[0].toLowerCase() ? "minor" : "major";
  else if (["m", "min", "minor", "-"].includes(rest)) mode = "minor";
  else if (["maj", "major"].includes(rest)) mode = "major";
  else return null;
  return { tonic: r.note.pc, mode };
}

/**
 * Chromatic offset from the tonic → scale-degree index (0 = 1st … 6 = 7th).
 * Raised 4th (#4) is preferred over b5; b2, b3, b6, b7 use flats. Shared by both modes.
 */
const DEGREE_OF_OFFSET = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

export function degreeOfOffset(offset: number): number {
  return DEGREE_OF_OFFSET[mod12(offset)];
}

/** Spell a pitch class so that it fits the key (e.g. pc 10 → "Bb" in F major, "A#" in B major). */
export function spellInKey(pc: PitchClass, key: Key): string {
  const tonicLetter = letterOf(tonicName(key));
  const degree = DEGREE_OF_OFFSET[mod12(pc - key.tonic)];
  const spelled = spellWithLetter(tonicLetter + degree, pc);
  if (spelled) return spelled;
  return (signatureFifths(key) < 0 ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

export const ALL_KEYS: Key[] = [
  ...Array.from({ length: 12 }, (_, t) => ({ tonic: t, mode: "major" as Mode })),
  ...Array.from({ length: 12 }, (_, t) => ({ tonic: t, mode: "minor" as Mode })),
];
