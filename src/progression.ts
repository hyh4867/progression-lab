/** Progression text parsing: chords separated by spaces; optional "|" bar lines; "%" repeats the previous chord. */
import { ChordParseError, parseChord, type Chord } from "./chord";
import { fmtEn, m, type Msg } from "./i18n";
import { mod12 } from "./pitch";
import type { Key } from "./key";
import { transposeChord } from "./chord";

export const BEATS_PER_BAR = 4;

export interface ProgressionItem {
  chord: Chord;
  /** Duration in beats. Without bar lines every chord is one 4-beat bar; inside a bar the beats are shared equally. */
  duration: number;
  bar: number; // 0-based bar index
}

export interface ParseIssue {
  token: string;
  message: string; // English
  msg: Msg; // language-neutral
}

export interface ParseResult {
  items: ProgressionItem[];
  errors: ParseIssue[];
}

export function parseProgression(text: string): ParseResult {
  const items: ProgressionItem[] = [];
  const errors: ParseIssue[] = [];
  const cleaned = text.replace(/[\n\r]+/g, " | ").replace(/,/g, " ");
  const hasBars = cleaned.includes("|");
  const bars = hasBars
    ? cleaned.split("|").map((b) => b.trim()).filter((b) => b.length > 0)
    : cleaned.split(/\s+/).filter((t) => t.length > 0);
  let prev: Chord | null = null;
  bars.forEach((bar, barIndex) => {
    const tokens = hasBars ? bar.split(/\s+/).filter((t) => t.length > 0) : [bar];
    const parsed: Chord[] = [];
    for (const token of tokens) {
      if (token === "%" || token === "-" || token === "/") {
        if (prev) parsed.push(prev);
        else errors.push({ token, message: fmtEn(m("err.repeat")), msg: m("err.repeat") });
        continue;
      }
      try {
        const c = parseChord(token);
        parsed.push(c);
        prev = c;
      } catch (e) {
        const msg = e instanceof ChordParseError ? e.msg : m("err.quality", { s: token });
        errors.push({ token, message: fmtEn(msg), msg });
      }
    }
    for (const chord of parsed) {
      items.push({ chord, duration: BEATS_PER_BAR / parsed.length, bar: barIndex });
    }
  });
  return { items, errors };
}

/** Format items back to text with bar lines. */
export function formatProgression(items: { chord: Chord; bar: number }[]): string {
  const bars: string[][] = [];
  for (const it of items) {
    (bars[it.bar] ??= []).push(it.chord.symbol);
  }
  return bars.filter(Boolean).map((b) => b.join(" ")).join(" | ");
}

export function transposeProgression(items: ProgressionItem[], semitones: number, targetKey: Key): ProgressionItem[] {
  return items.map((it) => ({ ...it, chord: transposeChord(it.chord, mod12(semitones), targetKey) }));
}
