import { describe, expect, it } from "vitest";
import { analyseProgression, detectCadences, analyseChord } from "../analysis";
import { parseProgression, transposeProgression } from "../progression";
import { parseKey, transposeKey, type Key } from "../key";
import { parseChord } from "../chord";
import { findKey } from "../keyfinding";
import { LABELLED_PROGRESSIONS } from "../corpus";

const romans = (s: string, k: string) => {
  const items = parseProgression(s).items;
  return analyseProgression(items, parseKey(k)!).map((a) => a.roman);
};
const cats = (s: string, k: string) => analyseProgression(parseProgression(s).items, parseKey(k)!).map((a) => a.category);

describe("Roman numerals", () => {
  it("diatonic triads and sevenths in major", () => {
    expect(romans("C Dm Em F G Am Bdim", "C")).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(romans("Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7b5", "C")).toEqual(["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"]);
  });

  it("minor-key forms including harmonic V and vii°", () => {
    expect(romans("Am Bdim C Dm Em E7 F G G#dim7", "Am")).toEqual(["i", "ii°", "III", "iv", "v", "V7", "VI", "VII", "vii°7"]);
  });

  it("inversion figures and foreign basses", () => {
    expect(romans("C/E G/D G7/F Dm7/C Am/G#", "C")[0]).toBe("I6");
    expect(romans("C/E G/D G7/F Dm7/C", "C")).toEqual(["I6", "V64", "V42", "ii42"]);
    expect(romans("Am Am/G#", "Am")[1]).toBe("i/^#7");
    expect(romans("C A7/C# Dm", "C")[1]).toBe("V65/ii");
  });

  it("names secondary dominants and leading-tone chords", () => {
    expect(romans("C A7 Dm D7 G E Am", "C")).toEqual(["I", "V7/ii", "ii", "V7/V", "V", "V/vi", "vi"]);
    expect(romans("C C#dim7 Dm F#dim7 G", "C")).toEqual(["I", "vii°7/ii", "ii", "vii°7/V", "V"]);
    expect(romans("C C7 F", "C")[1]).toBe("V7/IV");
  });

  it("names borrowed chords from the parallel key", () => {
    expect(romans("C Fm Ab Bb Eb Dm7b5", "C")).toEqual(["I", "iv", "bVI", "bVII", "bIII", "iiø7"]);
    expect(cats("C Fm Ab Bb Eb", "C").slice(1)).toEqual(["borrowed", "borrowed", "borrowed", "borrowed"]);
    expect(analyseChord(parseChord("A"), parseKey("Am")!).explanation).toMatch(/Picardy/);
    expect(romans("Dm7 G7 Dm7", "Dm")[1]).toBe("IV7"); // Dorian IV
    expect(romans("Cm Cm6 Cm", "Cm")[1]).toBe("iadd6"); // melodic-minor tonic colour; "add6" avoids the inversion figure
    expect(romans("C6 C6/9 C/E", "C")).toEqual(["Iadd6", "Iadd6(9)", "I6"]);
  });

  it("names tritone substitutions and the Neapolitan", () => {
    expect(romans("Dm7 Db7 C", "C")[1]).toBe("subV7");
    // v2: Ab7 → G in C has the pitch content of a German sixth; subV7/V is kept as the alternative reading.
    const ger = analyseProgression(parseProgression("Am7 Ab7 G7").items, parseKey("C")!)[1];
    expect(ger.roman).toBe("Ger+6");
    expect(ger.alternatives.join(" ")).toMatch(/tritone substitute of V\/V/);
    expect(romans("Cm Db/F G7 Cm", "Cm")[1]).toBe("N6");
    expect(cats("Cm Db G7 Cm", "Cm")[1]).toBe("neapolitan");
  });

  it("blues dominants and an honest fallback", () => {
    // I7 that moves to IV is read as V7/IV; IV7 and a non-resolving I7 are blues dominants.
    expect(cats("A7 D7 A7 E7", "A")).toEqual(["secondary-dominant", "blues-dominant", "blues-dominant", "diatonic"]);
    expect(romans("A7 D7 A7 E7", "A")).toEqual(["V7/IV", "IV7", "I7", "V7"]);
    expect(cats("Cmaj7 Eb7 Fmaj7", "C")[1]).not.toBe("tritone-sub"); // non-resolving "tritone" shape is not labelled subV
    // v2: no "?" — an unexplained chord gets a function inferred from its root degree.
    const a = analyseChord(parseChord("F#m"), parseKey("C")!);
    expect(a.category).toBe("chromatic");
    expect(a.inferred).toBe(true);
    expect(["T", "PD", "D", "PASS"]).toContain(a.function);
  });

  it("function labels", () => {
    const fx = analyseProgression(parseProgression("C Am F Dm G7 Bdim C").items, parseKey("C")!).map((a) => a.function);
    expect(fx).toEqual(["T", "T", "PD", "PD", "D", "D", "T"]);
  });
});

describe("cadences", () => {
  const cad = (s: string, k: string) => {
    const items = parseProgression(s).items;
    return detectCadences(items, analyseProgression(items, parseKey(k)!)).map((c) => `${c.type}@${c.at}`);
  };
  it("authentic, plagal, deceptive, half", () => {
    expect(cad("C F G7 C", "C")).toEqual(["authentic@3"]);
    expect(cad("C F C", "C")).toEqual(["plagal@2"]);
    expect(cad("C Fm C", "C")).toEqual(["plagal@2"]);
    expect(cad("C F G Am", "C")).toEqual(["deceptive@3"]);
    expect(cad("C Am F G", "C")).toEqual(["half@3"]);
    expect(cad("Am Dm E7 Am", "Am")).toEqual(["authentic@3"]);
    expect(cad("Am Dm E7 F", "Am")).toEqual(["deceptive@3"]);
    expect(cad("Bdim C", "C")).toEqual(["authentic@1"]);
  });
  it("a cadential 6-4 tonic is not an arrival", () => {
    expect(cad("G C/G", "C")).toEqual([]);
  });
});

describe("transposition invariance (property)", () => {
  it("analysis with the transposed key is identical in all 12 keys", () => {
    for (const p of LABELLED_PROGRESSIONS) {
      const items = parseProgression(p.chords).items;
      const key = parseKey(p.key)!;
      const base = analyseProgression(items, key);
      const baseCad = detectCadences(items, base);
      for (let t = 0; t < 12; t++) {
        const k: Key = transposeKey(key, t);
        const moved = transposeProgression(items, t, k);
        const a = analyseProgression(moved, k);
        expect(a.map((x) => [x.roman, x.function, x.category]), `${p.id} +${t}`).toEqual(base.map((x) => [x.roman, x.function, x.category]));
        expect(detectCadences(moved, a)).toEqual(baseCad);
      }
    }
  });

  it("analysis with the detected key is identical in all 12 keys", () => {
    for (const p of LABELLED_PROGRESSIONS) {
      const items = parseProgression(p.chords).items;
      const base = analyseProgression(items, findKey(items).best).map((x) => x.roman);
      for (let t = 1; t < 12; t++) {
        const moved = transposeProgression(items, t, transposeKey(findKey(items).best, t));
        expect(analyseProgression(moved, findKey(moved).best).map((x) => x.roman), `${p.id} +${t}`).toEqual(base);
      }
    }
  });
});
