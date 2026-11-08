import { describe, expect, it } from "vitest";
import { delta, tensionCurve, tonalTension, fifthsDistance, diatonicFifthsDistance, basicSpace, basicSpaceDistance } from "../tension";
import { parseChord } from "../chord";
import { parseKey, transposeKey } from "../key";
import { parseProgression, transposeProgression } from "../progression";
import { LABELLED_PROGRESSIONS } from "../corpus";

const C = parseKey("C")!;
const place = (s: string, k = C) => ({ chord: parseChord(s), region: k });

describe("Lerdahl chord distances (published TPS values within one key)", () => {
  // Lerdahl (2001), Table of diatonic δ values from I: δ(I,V)=5, δ(I,ii)=8, δ(I,vi)=7, δ(I,IV)=5, δ(I,iii)=7.
  it.each([
    ["G", 5], ["F", 5], ["Dm", 8], ["Am", 7], ["Em", 7],
  ])("δ(C → %s) = %d", (y, d) => {
    expect(delta(place("C"), place(y as string)).total).toBe(d);
  });

  it("δ is symmetric for diatonic triads", () => {
    const tri = ["C", "Dm", "Em", "F", "G", "Am"];
    for (const x of tri) for (const y of tri) expect(delta(place(x), place(y)).total).toBe(delta(place(y), place(x)).total);
  });

  it("region distance follows key signatures", () => {
    expect(delta(place("C"), place("C", parseKey("G")!)).i).toBe(1);
    expect(delta(place("C"), place("Cm", parseKey("Cm")!)).i).toBe(3);
    expect(delta(place("C"), place("Am", parseKey("Am")!)).i).toBe(0);
  });

  it("circle-of-fifths helpers", () => {
    expect(fifthsDistance(0, 7)).toBe(1);
    expect(fifthsDistance(0, 1)).toBe(5);
    expect(fifthsDistance(0, 6)).toBe(6);
    expect(diatonicFifthsDistance(5, 11, C)).toBe(1); // F–B is adjacent on the diatonic circle
    expect(diatonicFifthsDistance(0, 9, C)).toBe(3);
    expect(diatonicFifthsDistance(0, 1, C)).toBeNull();
  });

  it("k counts new pitch classes per level", () => {
    expect(basicSpaceDistance(basicSpace(parseChord("C"), C), basicSpace(parseChord("C"), C))).toBe(0);
    expect(basicSpaceDistance(basicSpace(parseChord("C"), C), basicSpace(parseChord("G"), C))).toBe(4);
  });
});

describe("tension sanity", () => {
  it("the tonic is the least tense chord in its key (major and minor)", () => {
    const major = ["Dm", "Em", "F", "G", "Am", "Bdim", "G7", "Fmaj7", "Ab", "Bb", "Fm", "D7", "Db"];
    const t0 = tonalTension(parseChord("C"), C);
    expect(t0).toBe(0);
    for (const s of major) expect(tonalTension(parseChord(s), C), s).toBeGreaterThan(t0);
    const am = parseKey("Am")!;
    const m0 = tonalTension(parseChord("Am"), am);
    for (const s of ["Bdim", "C", "Dm", "Em", "E7", "F", "G", "G#dim7"]) expect(tonalTension(parseChord(s), am), s).toBeGreaterThan(m0);
  });

  it("V7 is more tense than I, and more tense than V", () => {
    expect(tonalTension(parseChord("G7"), C)).toBeGreaterThan(tonalTension(parseChord("C"), C));
    expect(tonalTension(parseChord("G7"), C)).toBeGreaterThan(tonalTension(parseChord("G"), C));
  });

  it("V → I and V7 → I resolutions lower the tension", () => {
    for (const prog of ["C F G C", "C Am Dm G7 C", "Am Dm E7 Am", "F Bb C7 F"]) {
      const items = parseProgression(prog).items;
      const key = prog.startsWith("Am") ? parseKey("Am")! : prog.startsWith("F") ? parseKey("F")! : C;
      const t = tensionCurve(items, key).map((p) => p.total);
      expect(t[t.length - 1], prog).toBeLessThan(t[t.length - 2]);
    }
  });

  it("chromatic chords are more tense than their diatonic counterparts", () => {
    expect(tonalTension(parseChord("Db7"), C)).toBeGreaterThan(tonalTension(parseChord("G7"), C));
    expect(tonalTension(parseChord("Ab"), C)).toBeGreaterThan(tonalTension(parseChord("Am"), C));
  });

  it("values are transposition-invariant on every labelled progression", () => {
    for (const p of LABELLED_PROGRESSIONS) {
      const items = parseProgression(p.chords).items;
      const key = parseKey(p.key)!;
      const base = tensionCurve(items, key).map((x) => x.total);
      for (let t = 1; t < 12; t++) {
        const k = transposeKey(key, t);
        expect(tensionCurve(transposeProgression(items, t, k), k).map((x) => x.total), `${p.id} +${t}`).toEqual(base);
      }
    }
  });
});
