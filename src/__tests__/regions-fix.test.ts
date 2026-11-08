import { describe, expect, it } from "vitest";
import { analyseFull } from "../harmony";
import { analyseChord } from "../analysis";
import { cadenceAnchors } from "../regions";
import { parseProgression } from "../progression";
import { parseChord } from "../chord";
import { parseKey } from "../key";
import { findKey } from "../keyfinding";

const GIANT = "Bmaj7 D7 Gmaj7 Bb7 Ebmaj7 A-7 D7 Gmaj7";
const run = (s: string, k?: string) => {
  const items = parseProgression(s).items;
  const key = k ? parseKey(k)! : findKey(items).best;
  return analyseFull(items, key);
};
const regionsOf = (f: ReturnType<typeof run>) => f.regions.regions.map((r) => `${r.name}:${r.start + 1}-${r.end + 1}`);

describe("BUG 1: cadence-anchored key regions", () => {
  it("Giant Steps bars 1–5 with a manual Eb key: B → G → Eb → G", () => {
    const f = run(GIANT, "Eb");
    expect(regionsOf(f)).toEqual(["B:1-1", "G:2-3", "Eb:4-5", "G:6-8"]);
    expect(f.local[0]).toMatchObject({ keyName: "B", roman: "Imaj7" });
    expect(f.local[3]).toMatchObject({ keyName: "Eb", roman: "V7" });
    expect(f.local[4]).toMatchObject({ keyName: "Eb", roman: "Imaj7" });
    expect(f.local[5]).toMatchObject({ keyName: "G", roman: "ii7" });
  });

  it("the same regions without a manual key (auto-detected home key)", () => {
    const f = run(GIANT);
    expect(regionsOf(f)).toEqual(["B:1-1", "G:2-3", "Eb:4-5", "G:6-8"]);
  });

  it("a manual key does not force the first region (any home key gives the same regions)", () => {
    for (const k of ["C", "Eb", "D", "Am", "F#"]) expect(regionsOf(run(GIANT, k)), k).toEqual(["B:1-1", "G:2-3", "Eb:4-5", "G:6-8"]);
  });

  it("Giant Steps first 8 bars: B, G, Eb, G, Eb, B, Eb", () => {
    const f = run("B D7 G Bb7 Eb Am7 D7 G Bb7 Eb F#7 B Fm7 Bb7 Eb", "B");
    expect(f.regions.regions.map((r) => r.name)).toEqual(["B", "G", "Eb", "G", "Eb", "B", "Eb"]);
    expect(f.spans.some((s) => s.type === "coltrane-cycle")).toBe(true);
  });

  it("anchors include the ii of a ii–V–I and skip dominant-seventh 'arrivals'", () => {
    const items = parseProgression("Dm7 G7 Cmaj7 A7 D7 G7").items;
    const a = cadenceAnchors(items, parseKey("C")!);
    expect(a.map((x) => [x.key.tonic, x.start, x.end])).toEqual([[0, 0, 2]]);
  });

  it("stability: single applied chords inside one key stay inside it", () => {
    for (const [s, k] of [["C A7 Dm7 G7 C", "C"], ["C E7 Am F G C", "C"], ["C D7 G7 C", "C"], ["F C/E Dm Bb C7 F", "F"], ["C D7b5/Ab G C", "C"], ["G E7 Am7 D7 G", "G"]]) {
      const f = run(s, k);
      expect(f.regions.regions.length, s).toBe(1);
      expect(f.regions.regions[0].kind, s).toBe("home");
    }
  });

  it("a real modulation is still found, with its pivot chord", () => {
    const f = run("C F G7 C Am D7 G Em Am D7 G", "C");
    expect(f.regions.regions.map((r) => `${r.name}:${r.kind}`)).toEqual(["C:home", "G:modulation"]);
    expect(f.regions.pivots[0].index).toBe(4);
  });
});

describe("BUG 2: applied-chord target numerals follow the actual target chord", () => {
  const at = (s: string, k: string, i: number) => {
    const items = parseProgression(s).items;
    return analyseFull(items, parseKey(k)!).chords[i];
  };
  it("D7 → Gmaj7 in Eb is V7/III, not V7/iii", () => {
    expect(at("Ebmaj7 D7 Gmaj7", "Eb", 1).roman).toBe("V7/III");
    expect(at("Ebmaj7 D7 Gm7", "Eb", 1).roman).toBe("V7/iii");
  });
  it("same rule for other V/x and vii°/x", () => {
    expect(at("C E7 A", "C", 1).roman).toBe("V7/VI");
    expect(at("C E7 Am", "C", 1).roman).toBe("V7/vi");
    expect(at("C A7 D", "C", 1).roman).toBe("V7/II");
    expect(at("C G#dim7 A", "C", 1).roman).toBe("vii°7/VI");
    expect(at("C G#dim7 Am", "C", 1).roman).toBe("vii°7/vi");
    expect(at("C C#dim Dm", "C", 1).roman).toBe("vii°/ii");
    expect(at("C C#dim D", "C", 1).roman).toBe("vii°/II");
  });
  it("a dominant seventh resolving to a chromatic chord is V7/x of it; a plain triad among borrowed chords stays mixture", () => {
    expect(at("G Bb7 Eb", "G", 1).roman).toBe("V7/bVI");
    expect(analyseChord(parseChord("Bb"), parseKey("C")!, parseChord("Eb")).roman).toBe("bVII");
  });
});
