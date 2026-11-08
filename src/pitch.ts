/** Pitch-class utilities. Pitch classes are integers 0..11 with C = 0. */

export type PitchClass = number;

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
/** Natural pitch class of each letter, indexed like LETTERS. */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export interface NoteName {
  letter: number; // index into LETTERS
  accidental: number; // -2..2
  pc: PitchClass;
  text: string; // normalised spelling, e.g. "Bb"
}

const ACCIDENTAL_TEXT: Record<number, string> = { [-2]: "bb", [-1]: "b", 0: "", 1: "#", 2: "##" };

function accidentalValue(raw: string): number | null {
  const s = raw.replace(/♯/g, "#").replace(/♭/g, "b").replace(/𝄪/g, "##").replace(/x/g, "##");
  if (s === "") return 0;
  if (/^#+$/.test(s)) return s.length <= 2 ? s.length : null;
  if (/^b+$/.test(s)) return s.length <= 2 ? -s.length : null;
  return null;
}

/**
 * Parse a note name at the start of `s` (uppercase letter required).
 * Returns the parsed note and the number of characters consumed.
 */
export function parseNotePrefix(s: string): { note: NoteName; length: number } | null {
  const m = /^([A-G])(##|bb|#|b|♯♯|♭♭|♯|♭|𝄪)?/.exec(s);
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1] as (typeof LETTERS)[number]);
  const acc = accidentalValue(m[2] ?? "");
  if (acc === null) return null;
  const pc = mod12(LETTER_PC[letter] + acc);
  return {
    note: { letter, accidental: acc, pc, text: LETTERS[letter] + ACCIDENTAL_TEXT[acc] },
    length: m[0].length,
  };
}

export function parseNoteName(s: string): NoteName | null {
  const r = parseNotePrefix(s.trim());
  if (!r || r.length !== s.trim().length) return null;
  return r.note;
}

/** Spell pitch class `pc` using letter index `letter`; null if it needs more than a double accidental. */
export function spellWithLetter(letter: number, pc: PitchClass): string | null {
  const l = mod(letter, 7);
  let acc = mod12(pc - LETTER_PC[l]);
  if (acc > 6) acc -= 12;
  if (acc < -2 || acc > 2) return null;
  return LETTERS[l] + ACCIDENTAL_TEXT[acc];
}

export function letterOf(name: string): number {
  return LETTERS.indexOf(name[0] as (typeof LETTERS)[number]);
}
