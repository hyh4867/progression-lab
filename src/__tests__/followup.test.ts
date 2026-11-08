import { describe, expect, it } from "vitest";
import { keyPanel, keyCentres } from "../keyPanel";
import { findKey } from "../keyfinding";
import { analyseFull } from "../harmony";
import { parseProgression } from "../progression";
import { parseKey, spellInKey } from "../key";
import { fmt } from "../i18n";
import { tensionCurve } from "../tension";
import { buildCirclePath, classifyMove } from "../circle";
import { reharmonise, presetTarget } from "../reharm";
import { LABELLED_PROGRESSIONS } from "../corpus";

const GIANT = "Bmaj7 D7 Gmaj7 Bb7 Ebmaj7 A-7 D7 Gmaj7";
const setup = (s: string, manual?: string) => {
  const items = parseProgression(s).items;
  const result = findKey(items);
  const key = manual ? parseKey(manual)! : result.best;
  return { items, result, key, full: analyseFull(items, key) };
};

describe("FOLLOW-UP 1–2: key panel", () => {
  it("manual key: header is the manual key; auto statistics are labelled and related to the auto-detected key", () => {
    const { result, full, key } = setup(GIANT, "Eb");
    const kp = keyPanel(result, key, full.regions.regions, full.spans);
    expect(fmt("en", kp.header)).toBe("Eb major");
    expect(fmt("en", kp.stats)).toBe("Auto-detected: D major, r = 0.70; runner-up B minor = its relative key (r = 0.64).");
    expect(fmt("ko", kp.stats)).toBe("자동 판별: D 장조, r = 0.70; 2위 B 단조 = D 장조의 나란한조 (r = 0.64).");
    // B minor is NOT the relative key of the manual key (Eb major); nothing may say so.
    for (const lang of ["en", "ko"] as const) expect(fmt(lang, kp.stats) + fmt(lang, kp.note)).not.toMatch(/Eb major's relative|Eb 장조의 나란한조/);
  });

  it("3+ key centres (Coltrane): the note names them in EN and KO", () => {
    for (const manual of ["Eb", undefined]) {
      const { result, full, key } = setup(GIANT, manual);
      const kp = keyPanel(result, manual ? key : null, full.regions.regions, full.spans);
      expect(kp.noteKind).toBe("centres");
      expect(fmt("en", kp.note)).toBe("This progression moves through 3 key centres: B, G, Eb.");
      expect(fmt("ko", kp.note)).toBe("이 진행은 조성 중심 3개를 거칩니다: B, G, Eb.");
    }
    expect(keyCentres(setup("C F G7 C Am D7 G Em Am D7 G", "C").full.regions.regions)).toEqual(["C", "G"]);
  });

  it("an ambiguous auto-detection under a manual key relates the runner-up to the detected key", () => {
    const { result, full } = setup("Am C Am C", "C");
    const kp = keyPanel(result, parseKey("C")!, full.regions.regions, full.spans);
    expect(kp.noteKind).toBe("ambiguous");
    expect(fmt("en", kp.note)).toBe("Auto-detection alone is ambiguous between C major and A minor (A minor is its relative key of C major); the numerals use your chosen key, C major.");
  });

  it("without a manual key and a clear result, nothing changes", () => {
    const { result, full } = setup("C F G7 C");
    const kp = keyPanel(result, null, full.regions.regions, full.spans);
    expect(kp.noteKind).toBe("clear");
    expect(fmt("en", kp.stats)).toMatch(/^Confidence \d+%/);
  });
});

describe("FOLLOW-UP 3: tension measured against each region's tonic", () => {
  it("single-key progressions give identical values", () => {
    let checked = 0;
    for (const p of LABELLED_PROGRESSIONS) {
      const items = parseProgression(p.chords).items;
      const key = parseKey(p.key)!;
      const full = analyseFull(items, key);
      if (full.regions.regions.length > 1) continue;
      const plain = tensionCurve(items, key, full.chords).map((x) => x.total);
      expect(tensionCurve(items, key, full.chords, full.regions.path).map((x) => x.total), p.id).toEqual(plain);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("Giant Steps: chords in other regions are measured from their own tonic; home-region chords are unchanged", () => {
    const { items, key, full } = setup(GIANT, "Eb");
    const before = tensionCurve(items, key, full.chords).map((x) => x.total);
    const after = tensionCurve(items, key, full.chords, full.regions.path).map((x) => x.total);
    // Home region (Eb, chords 4–5): identical.
    expect(after[3]).toBe(before[3]);
    expect(after[4]).toBe(before[4]);
    // Arrival tonics of the B and G regions drop sharply: they are local tonics now.
    expect(after[0]).toBeLessThan(before[0] / 1.5);
    expect(after[2]).toBeLessThan(before[2] / 1.5);
    expect(after[7]).toBeLessThan(before[7] / 1.5);
    // The ii7 of the new G region drops too (22 → 19) …
    expect(after[5]).toBeLessThan(before[5]);
    // … but it stays the global maximum: ii7 is the diatonic chord farthest from its own tonic (δ = 8) and it is
    // entered by a tritone root jump from Ebmaj7. Recorded honestly instead of tuning the model to this case.
    expect(after.indexOf(Math.max(...after))).toBe(5);
  });
});

describe("FOLLOW-UP 3: the reharmoniser uses the same regional curve", () => {
  it("with region keys, the original curve equals the displayed curve and the invariants hold", () => {
    const { items, key, full } = setup(GIANT, "Eb");
    const regionKeys = full.regions.path;
    const curve = tensionCurve(items, key, full.chords, regionKeys).map((p) => p.total);
    const locked = items.map((_, i) => i === 0 || i === items.length - 1);
    const r = reharmonise({ items, key, target: presetTarget(curve, "arch"), locked, regionKeys });
    r.original.slotCurve.forEach((v, i) => expect(v).toBeCloseTo(curve[i], 9));
    for (const s of r.suggestions) {
      expect(s.curveDistance).toBeLessThanOrEqual(r.original.curveDistance + 1e-9);
      for (const c of s.changes) expect(locked[c.slot]).toBe(false);
    }
  });
});

describe("FOLLOW-UP 4: true root motion for circle arrows", () => {
  it("names the real roots, not the relative-major spoke", () => {
    const items = parseProgression("Eb Am").items;
    const key = parseKey("C")!;
    const full = analyseFull(items, key);
    const path = buildCirclePath(items, full.chords, key);
    const [a, b] = path.nodes;
    expect([spellInKey(a.rootPc, key), spellInKey(b.rootPc, key)]).toEqual(["Eb", "A"]);
    expect(b.spoke).toBe(0); // Am is drawn under C …
    expect(classifyMove(a.rootPc, a.ring, b.rootPc, b.ring).kind).toBe("tritone"); // … but Eb → A is a tritone
  });

  it("a tritone substitute's resolution is drawn as the tritone line but is truly a semitone", () => {
    const items = parseProgression("Dm7 Db7 Cmaj7").items;
    const key = parseKey("C")!;
    const full = analyseFull(items, key);
    const path = buildCirclePath(items, full.chords, key);
    const m = path.moves[1];
    expect(m.kind).toBe("tritone");
    const a = path.nodes.find((n) => n.id === m.fromNode)!, b = path.nodes.find((n) => n.id === m.toNode)!;
    expect(classifyMove(a.rootPc, a.ring, b.rootPc, b.ring).kind).toBe("semitone");
  });
});
