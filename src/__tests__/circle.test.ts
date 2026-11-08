import { describe, expect, it } from "vitest";
import {
  spokeOfPc, spokeAngle, ringOf, spokeOf, slotLabel, keyWindow, inKeyWindow, classifyMove, buildCirclePath,
  fallingFifthChains, coltraneTriangle, twoChordVamp, motionSummary, point, nodePoint, GEOMETRY,
} from "../circle";
import { parseChord } from "../chord";
import { parseKey, transposeKey } from "../key";
import { parseProgression, transposeProgression } from "../progression";
import { analyseFull } from "../harmony";
import { LABELLED_PROGRESSIONS } from "../corpus";

const C = parseKey("C")!;
const build = (s: string, k: string) => {
  const items = parseProgression(s).items;
  const key = parseKey(k)!;
  const full = analyseFull(items, key);
  return { items, key, full, path: buildCirclePath(items, full.chords, key) };
};

describe("spokes and rings", () => {
  it("C is at 12 o'clock and G is the next spoke clockwise", () => {
    expect(spokeOfPc(0)).toBe(0);
    expect(spokeOfPc(7)).toBe(1);
    expect(spokeAngle(spokeOfPc(0))).toBe(0);
    const c = point(0, 100), g = point(1, 100);
    expect(c.x).toBeCloseTo(GEOMETRY.centre, 9);
    expect(c.y).toBeLessThan(GEOMETRY.centre);
    expect(g.x).toBeGreaterThan(c.x);
    expect(spokeOfPc(5)).toBe(11); // F is counter-clockwise of C
  });

  it("rings: major family outer, minor family middle, diminished inner", () => {
    for (const s of ["C", "C7", "Cmaj7", "C6", "Csus4", "Caug", "C5"]) expect(ringOf(parseChord(s)), s).toBe("outer");
    for (const s of ["Am", "Am7", "Am6", "AmMaj7"]) expect(ringOf(parseChord(s)), s).toBe("middle");
    for (const s of ["Bdim", "Bm7b5", "Bdim7"]) expect(ringOf(parseChord(s)), s).toBe("inner");
  });

  it("Am sits under C and B° under C", () => {
    expect(spokeOf(9, "middle")).toBe(0);
    expect(spokeOf(11, "inner")).toBe(0);
    expect(spokeOf(4, "middle")).toBe(1); // Em under G
  });

  it("slot labels use the key's enharmonic spelling", () => {
    const fs = spokeOfPc(6);
    expect(slotLabel(fs, "outer", parseKey("G")!)).toBe("F#");
    expect(slotLabel(fs, "outer", parseKey("Db")!)).toBe("Gb");
    expect(slotLabel(spokeOfPc(1), "outer", parseKey("Ab")!)).toBe("Db");
    expect(slotLabel(spokeOfPc(1), "outer", parseKey("E")!)).toBe("C#");
    expect(slotLabel(0, "middle", C)).toBe("Am");
    expect(slotLabel(0, "inner", C)).toBe("B°");
    expect(slotLabel(spokeOfPc(8), "middle", parseKey("Eb")!)).toBe("Fm");
    // E#/B#/Fb/Cb are replaced by their plain names; other key-aware spellings stay.
    expect(slotLabel(spokeOfPc(5), "outer", parseKey("B")!)).toBe("F");
    expect(slotLabel(spokeOfPc(3), "outer", parseKey("B")!)).toBe("D#");
  });
});

describe("key window", () => {
  it("major key: IV–I–V outer, ii–vi–iii middle, vii° inner", () => {
    expect(keyWindow(C)).toEqual({ centre: 0, spokes: [11, 0, 1], tonicRing: "outer" });
    const inC = (s: string) => { const ch = parseChord(s); return inKeyWindow(ch.root, ringOf(ch), C); };
    for (const s of ["C", "F", "G", "Dm", "Em", "Am", "Bdim", "G7", "Fmaj7"]) expect(inC(s), s).toBe(true);
    for (const s of ["D", "E", "Bb", "Fm", "Ab", "C#dim", "F#m"]) expect(inC(s), s).toBe(false);
  });

  it("minor key uses the relative major's wedge with the tonic on the middle ring, plus harmonic V and vii°", () => {
    const am = parseKey("Am")!;
    expect(keyWindow(am)).toEqual({ centre: 0, spokes: [11, 0, 1], tonicRing: "middle" });
    const inAm = (s: string) => { const ch = parseChord(s); return inKeyWindow(ch.root, ringOf(ch), am); };
    for (const s of ["Am", "Dm", "Em", "C", "F", "G", "E", "E7", "Bdim", "G#dim7"]) expect(inAm(s), s).toBe(true);
    expect(inAm("D")).toBe(false);
  });
});

describe("motion classification", () => {
  const k = (a: string, b: string, dev?: string) => {
    const x = parseChord(a), y = parseChord(b);
    return classifyMove(x.root, ringOf(x), y.root, ringOf(y), dev).kind;
  };
  it("named cases", () => {
    expect(k("G7", "C")).toBe("falling-fifth");
    expect(k("C", "G")).toBe("rising-fifth");
    expect(k("C", "Am")).toBe("relative");
    expect(k("Am", "C")).toBe("relative");
    expect(k("C", "D")).toBe("second");
    expect(k("C", "E")).toBe("third");
    expect(k("C", "A")).toBe("third");
    expect(k("C", "Db")).toBe("semitone");
    expect(k("C", "F#")).toBe("tritone");
    expect(k("C", "Cm")).toBe("same-root");
  });

  it("Db7 → C is drawn as the tritone line (tritone substitution)", () => {
    const { path, full } = build("Dm7 Db7 Cmaj7", "C");
    expect(full.chords[1].device).toBe("tritone-sub");
    expect(path.moves.map((m) => m.kind)).toEqual(["semitone", "tritone"]);
  });

  it("repeated chords reuse a node and add no move", () => {
    const { path } = build("C C G C", "C");
    expect(path.nodes.find((n) => n.id === "outer:0")!.indices).toEqual([0, 1, 3]);
    expect(path.moves.length).toBe(2);
  });
});

describe("patterns and summary", () => {
  it("falling-fifth chain and summary counts", () => {
    const { path } = build("Am7 D7 Gmaj7 Cmaj7 F#m7b5 B7 Em", "Em");
    const s = motionSummary(path);
    expect(s.total).toBe(6);
    expect(s.counts["falling-fifth"]).toBe(5);
    expect(s.counts.tritone).toBe(1);
    expect(s.top).toBe("falling-fifth");
    expect(fallingFifthChains(path)).toEqual([{ start: 0, end: 3 }]);
  });

  it("Coltrane triangle on B D7 G Bb7 Eb F#7 B", () => {
    const { items, full } = build("B D7 G Bb7 Eb F#7 B", "B");
    expect(coltraneTriangle(items, full.spans)).toEqual([spokeOfPc(11), spokeOfPc(7), spokeOfPc(3)]);
    // An equilateral triangle: the three spokes are 4 apart.
    const t = coltraneTriangle(items, full.spans)!.slice().sort((a, b) => a - b);
    expect([t[1] - t[0], t[2] - t[1]]).toEqual([4, 4]);
  });

  it("two-chord vamp", () => {
    expect(twoChordVamp(build("Am D Am D", "Am").path)).toEqual(["middle:0", "outer:2"]);
    expect(twoChordVamp(build("C G Am F", "C").path)).toBeNull();
  });

  it("the model is transposition-invariant (rings, relative spokes, move kinds)", () => {
    for (const p of LABELLED_PROGRESSIONS) {
      const a = build(p.chords, p.key);
      const sig = (x: typeof a.path, k: number) => [x.nodes.map((n) => [n.ring, (n.spoke - k + 12) % 12, n.inKey, n.indices]), x.moves.map((m) => m.kind)];
      const base = sig(a.path, spokeOfPc(a.key.tonic));
      for (let t = 1; t < 12; t++) {
        const key = transposeKey(a.key, t);
        const items = transposeProgression(a.items, t, key);
        const full = analyseFull(items, key);
        expect(sig(buildCirclePath(items, full.chords, key), spokeOfPc(key.tonic)), `${p.id} +${t}`).toEqual(base);
      }
    }
  });

  it("node positions lie on their ring radius", () => {
    const n = { spoke: 3, ring: "middle" as const };
    const p = nodePoint(n);
    expect(Math.hypot(p.x - GEOMETRY.centre, p.y - GEOMETRY.centre)).toBeCloseTo(GEOMETRY.ringRadius.middle, 9);
  });
});

describe("library signatures", () => {
  it("every named progression yields a circle path whose nodes and moves are consistent", async () => {
    const { LIBRARY } = await import("../library");
    for (const e of LIBRARY) {
      const { items, path } = build(e.chords, e.key);
      expect(path.chordNode.length, e.id).toBe(items.length);
      expect(path.nodes.reduce((s, n) => s + n.indices.length, 0), e.id).toBe(items.length);
      for (const m of path.moves) expect(m.fromNode).not.toBe(m.toNode);
    }
  });
});
