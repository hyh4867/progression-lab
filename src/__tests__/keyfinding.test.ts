import { describe, expect, it } from "vitest";
import { findKey, pearson, scoreKeys, KK_MAJOR, mirexKeyScore } from "../keyfinding";
import { parseProgression, transposeProgression } from "../progression";
import { keyShortName, parseKey, transposeKey } from "../key";
import { LABELLED_PROGRESSIONS } from "../corpus";
import { evaluateKeyFinding } from "../evaluation";

const items = (s: string) => parseProgression(s).items;

describe("key finding", () => {
  it("returns all 24 keys ranked by score", () => {
    const r = findKey(items("C G Am F"));
    expect(r.ranked).toHaveLength(24);
    for (let i = 1; i < 24; i++) expect(r.ranked[i - 1].score).toBeGreaterThanOrEqual(r.ranked[i].score);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("finds unambiguous textbook keys", () => {
    expect(keyShortName(findKey(items("C F G7 C")).best)).toBe("C");
    expect(keyShortName(findKey(items("Am Dm E7 Am")).best)).toBe("Am");
    expect(keyShortName(findKey(items("Eb Ab Bb7 Eb")).best)).toBe("Eb");
  });

  it("flags close relative-key results as ambiguous", () => {
    // A bare relative-major/minor shared triad set: C and Am chords only.
    const r = findKey(items("Am C Am C"));
    expect(r.ambiguous).toBe(true);
    expect(r.alternative?.relation).toBe("relative");
  });

  it("the correlation of a profile with itself is 1", () => {
    expect(pearson(KK_MAJOR, KK_MAJOR)).toBeCloseTo(1, 12);
  });

  it("is transposition-equivariant on every labelled progression", () => {
    for (const p of LABELLED_PROGRESSIONS) {
      const base = items(p.chords);
      const k0 = findKey(base).best;
      for (let t = 1; t < 12; t++) {
        const moved = transposeProgression(base, t, transposeKey(k0, t));
        expect(findKey(moved).best, `${p.id} +${t}`).toEqual(transposeKey(k0, t));
      }
    }
  });

  it("scores a constant histogram as zero correlation everywhere", () => {
    expect(scoreKeys(new Array(12).fill(1)).every((s) => s.score === 0)).toBe(true);
  });

  it("MIREX-style partial credit", () => {
    const C = parseKey("C")!;
    expect(mirexKeyScore(C, C)).toBe(1);
    expect(mirexKeyScore(parseKey("G")!, C)).toBe(0.5);
    expect(mirexKeyScore(parseKey("Am")!, C)).toBe(0.3);
    expect(mirexKeyScore(parseKey("Cm")!, C)).toBe(0.2);
    expect(mirexKeyScore(parseKey("F#")!, C)).toBe(0);
  });
});

describe("labelled set", () => {
  it("has at least 40 progressions, each parsing cleanly with a valid key label", () => {
    expect(LABELLED_PROGRESSIONS.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(LABELLED_PROGRESSIONS.map((p) => p.id));
    expect(ids.size).toBe(LABELLED_PROGRESSIONS.length);
    for (const p of LABELLED_PROGRESSIONS) {
      expect(parseProgression(p.chords).errors, p.id).toEqual([]);
      expect(parseKey(p.key), p.id).not.toBeNull();
    }
  });

  it("reports accuracy (printed; floor is a regression guard, not a target)", () => {
    const s = evaluateKeyFinding();
    console.log(
      `[key-finding] exact ${s.correct}/${s.n} = ${(s.accuracy * 100).toFixed(1)}%  ` +
        `top-2 ${s.top2}/${s.n}  MIREX ${s.mirexMean.toFixed(3)}  ambiguous-flagged ${s.ambiguousFlagged}  ` +
        `non-hard ${s.nonHardCorrect}/${s.nonHardN}  hard ${s.hardCorrect}/${s.hardN}`,
    );
    console.log("[key-finding] misses:", JSON.stringify(s.misses));
    expect(s.accuracy).toBeGreaterThan(0.5);
  });
});
