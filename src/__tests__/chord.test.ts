import { describe, expect, it } from "vitest";
import { parseChord, tryParseChord, transposeChord, makeChord, respell } from "../chord";
import { parseKey, spellInKey, type Key } from "../key";
import { parseProgression } from "../progression";

const C: Key = { tonic: 0, mode: "major" };

/** [symbol, canonical quality, expected pitch classes from C-rooted reading, bass] */
const CASES: [string, string, number[], number][] = [
  ["C", "maj", [0, 4, 7], 0],
  ["Cm", "m", [0, 3, 7], 0],
  ["C7", "7", [0, 4, 7, 10], 0],
  ["Cmaj7", "maj7", [0, 4, 7, 11], 0],
  ["Cm7", "m7", [0, 3, 7, 10], 0],
  ["Cm7b5", "m7b5", [0, 3, 6, 10], 0],
  ["Cdim", "dim", [0, 3, 6], 0],
  ["Cdim7", "dim7", [0, 3, 6, 9], 0],
  ["Caug", "aug", [0, 4, 8], 0],
  ["Csus2", "sus2", [0, 2, 7], 0],
  ["Csus4", "sus4", [0, 5, 7], 0],
  ["C6", "6", [0, 4, 7, 9], 0],
  ["Cm6", "m6", [0, 3, 7, 9], 0],
  ["C9", "9", [0, 2, 4, 7, 10], 0],
  ["Cadd9", "add9", [0, 2, 4, 7], 0],
  ["C7b9", "7b9", [0, 1, 4, 7, 10], 0],
  ["C7#9", "7#9", [0, 3, 4, 7, 10], 0],
  ["C13", "13", [0, 2, 4, 7, 9, 10], 0],
  ["C/E", "maj", [0, 4, 7], 4],
];

describe("chord parsing", () => {
  it.each(CASES)("%s → %s", (symbol, quality, pcs, bass) => {
    const c = parseChord(symbol);
    expect(c.root).toBe(0);
    expect(c.quality).toBe(quality);
    expect(c.pcs).toEqual(pcs);
    expect(c.bass).toBe(bass);
  });

  it("accepts common alternative spellings", () => {
    const alt: [string, string][] = [
      ["CM7", "maj7"], ["CΔ7", "maj7"], ["CΔ", "maj7"], ["Cmin7", "m7"], ["C-7", "m7"], ["Cø7", "m7b5"],
      ["Cø", "m7b5"], ["C°7", "dim7"], ["C°", "dim"], ["C+", "aug"], ["Cm7(b5)", "m7b5"], ["Csus", "sus4"],
      ["Cmaj", "maj"], ["CM", "maj"], ["C7(b9)", "7b9"], ["C7(#9)", "7#9"], ["Cadd2", "add9"], ["Cmin", "m"],
      ["C6/9", "6/9"], ["Cm(maj7)", "mMaj7"], ["C7sus4", "7sus4"], ["C5", "5"], ["Cmaj9", "maj9"], ["Cm9", "m9"],
    ];
    for (const [s, q] of alt) expect(parseChord(s).quality, s).toBe(q);
  });

  it("6/9 is not mistaken for a slash chord, but 6/9/E is", () => {
    expect(parseChord("C6/9").hasSlash).toBe(false);
    const c = parseChord("C6/9/E");
    expect(c.hasSlash).toBe(true);
    expect(c.bass).toBe(4);
  });

  it("parses sharps, flats, unicode accidentals and enharmonics to the same pitch classes", () => {
    expect(parseChord("F#m7").pcs).toEqual(parseChord("Gbm7").pcs);
    expect(parseChord("B♭7").root).toBe(10);
    expect(parseChord("A#7").root).toBe(10);
    expect(parseChord("Cb").root).toBe(11);
    expect(parseChord("E#").root).toBe(5);
    expect(parseChord("Bbmaj7/D").bass).toBe(2);
    expect(parseChord("D/F#").bass).toBe(6);
  });

  it("rejects junk", () => {
    for (const s of ["", "H7", "Cxyz", "c", "7", "C/"]) expect(tryParseChord(s), s).toBeNull();
  });

  it("marks the plain 5th optional and altered 5ths required", () => {
    expect(parseChord("C7").tones.find((t) => t.role === "fifth")?.optional).toBe(true);
    expect(parseChord("Cm7b5").tones.find((t) => t.role === "fifth")?.optional).toBe(false);
    expect(parseChord("Caug").tones.find((t) => t.role === "fifth")?.optional).toBe(false);
  });

  it("a slash bass equal to the root is not a slash chord", () => {
    expect(parseChord("C/C").hasSlash).toBe(false);
  });
});

describe("spelling and transposition", () => {
  it("spells pitch classes to fit the key", () => {
    expect(spellInKey(10, parseKey("F")!)).toBe("Bb");
    expect(spellInKey(10, parseKey("B")!)).toBe("A#");
    expect(spellInKey(6, parseKey("G")!)).toBe("F#");
    expect(spellInKey(8, parseKey("C")!)).toBe("Ab"); // bVI in C
    expect(spellInKey(11, parseKey("Cm")!)).toBe("B"); // leading tone in C minor
    expect(spellInKey(5, parseKey("F#")!)).toBe("E#");
    expect(spellInKey(3, parseKey("Eb")!)).toBe("Eb");
  });

  it("transposes chords and keeps the written suffix", () => {
    const t = transposeChord(parseChord("Cmaj7/E"), 3, parseKey("Eb")!);
    expect(t.symbol).toBe("Ebmaj7/G");
    expect(transposeChord(parseChord("Am7"), 1, parseKey("Bb")!).symbol).toBe("Bbm7");
    expect(transposeChord(parseChord("Am7"), 1, parseKey("F#m")!).symbol).toBe("A#m7");
  });

  it("transposing by 12 is the identity on pitch content", () => {
    for (const [s] of CASES) {
      const c = parseChord(s);
      const t = transposeChord(c, 12, C);
      expect(t.pcs).toEqual(c.pcs);
      expect(t.bass).toBe(c.bass);
    }
  });

  it("makeChord and respell round-trip through the parser", () => {
    const k = parseKey("Ab")!;
    expect(makeChord(1, "maj7", k).symbol).toBe("Dbmaj7");
    expect(makeChord(7, "m7b5", k).symbol).toBe("Gm7b5");
    expect(respell(parseChord("G#m"), parseKey("E")!).symbol).toBe("G#m");
    expect(respell(parseChord("G#"), parseKey("Eb")!).symbol).toBe("Ab");
  });

  it("parses keys", () => {
    expect(parseKey("Am")).toEqual({ tonic: 9, mode: "minor" });
    expect(parseKey("f# minor")).toEqual({ tonic: 6, mode: "minor" });
    expect(parseKey("Bb")).toEqual({ tonic: 10, mode: "major" });
    expect(parseKey("e")).toEqual({ tonic: 4, mode: "minor" });
    expect(parseKey("Xm")).toBeNull();
  });
});

describe("progression parsing", () => {
  it("one chord per bar without bar lines", () => {
    const r = parseProgression("C G Am F");
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => i.duration)).toEqual([4, 4, 4, 4]);
  });
  it("bar lines share beats and % repeats", () => {
    const r = parseProgression("C G | Am | % F");
    expect(r.items.map((i) => [i.chord.symbol, i.duration, i.bar])).toEqual([
      ["C", 2, 0], ["G", 2, 0], ["Am", 4, 1], ["Am", 2, 2], ["F", 2, 2],
    ]);
  });
  it("reports bad tokens without dropping good ones", () => {
    const r = parseProgression("C Hm7 G");
    expect(r.items.length).toBe(2);
    expect(r.errors[0].token).toBe("Hm7");
  });
});
