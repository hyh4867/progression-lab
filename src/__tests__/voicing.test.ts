import { describe, expect, it } from "vitest";
import {
  generateVoicings, optimiseVoicingPath, bruteForceVoicingPath, requiredPcs, capoFret, capoSuggestions,
  formatTab, formatFrets, pathCost, STANDARD_TUNING,
} from "../voicing";
import { parseChord } from "../chord";
import { parseKey } from "../key";
import { mod12 } from "../pitch";
import { LABELLED_PROGRESSIONS } from "../corpus";
import { parseProgression } from "../progression";
import { karplusStrong, midiToFrequency } from "../audio";

const pcsOf = (frets: (number | null)[]) =>
  new Set(frets.map((f, s) => (f === null ? -1 : mod12(STANDARD_TUNING[s] + f))).filter((x) => x >= 0));

function checkVoicing(symbol: string, frets: (number | null)[]) {
  const c = parseChord(symbol);
  const sounding = pcsOf(frets);
  for (const pc of requiredPcs(c)) expect(sounding.has(pc), `${symbol} ${frets.join(",")} missing pc ${pc}`).toBe(true);
  for (const pc of sounding) expect(c.pcs.includes(pc) || pc === c.bass, `${symbol} has foreign pc ${pc}`).toBe(true);
  const lowest = frets.findIndex((f) => f !== null);
  expect(mod12(STANDARD_TUNING[lowest] + (frets[lowest] as number)), `${symbol} bass`).toBe(c.bass);
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
  expect(Math.max(0, ...fretted)).toBeLessThanOrEqual(15);
}

describe("voicing generation", () => {
  it("ranks the familiar open shapes first", () => {
    const first = (s: string) => formatFrets(generateVoicings(parseChord(s))[0]);
    expect(first("C")).toBe("x32010");
    expect(first("G")).toBe("320003");
    expect(first("A")).toBe("x02220");
    expect(first("E")).toBe("022100");
    expect(first("Am")).toBe("x02210");
    expect(first("Em")).toBe("022000");
    expect(first("D")).toBe("xx0232");
  });

  it("includes the barre F and respects slash basses", () => {
    expect(generateVoicings(parseChord("F")).map(formatFrets)).toContain("133211");
    expect(formatFrets(generateVoicings(parseChord("C/E"))[0])[0]).toBe("0");
    expect(formatFrets(generateVoicings(parseChord("G/B"))[0]).slice(0, 2)).toBe("x2");
  });

  it("every generated voicing for every chord in the labelled set is valid", () => {
    const symbols = new Set(LABELLED_PROGRESSIONS.flatMap((p) => parseProgression(p.chords).items.map((i) => i.chord.symbol)));
    for (const extra of ["C13", "E7#9", "C7b9", "Cadd9", "Csus2", "Caug", "Cdim7", "Cm6", "C6", "C9", "Bbmaj7/D"]) symbols.add(extra);
    for (const s of symbols) {
      const vs = generateVoicings(parseChord(s));
      expect(vs.length, s).toBeGreaterThan(0);
      for (const v of vs) checkVoicing(s, v.frets);
    }
  });

  it("an omitted 5th is allowed but other tones are required", () => {
    const vs = generateVoicings(parseChord("G7"), { maxPerChord: 200 });
    expect(vs.some((v) => !pcsOf(v.frets).has(2))).toBe(true); // some G7 voicing omits D
    expect(vs.every((v) => pcsOf(v.frets).has(5) && pcsOf(v.frets).has(11))).toBe(true); // F and B always present
  });

  it("bassFree drops the bass constraint", () => {
    const strict = generateVoicings(parseChord("C/G"), { maxPerChord: 500 });
    const free = generateVoicings(parseChord("C/G"), { maxPerChord: 500, bassFree: true });
    expect(free.length).toBeGreaterThan(strict.length);
  });
});

describe("voicing path (Viterbi vs brute force)", () => {
  const progressions = LABELLED_PROGRESSIONS.map((p) => parseProgression(p.chords).items.map((i) => i.chord));
  it("the DP optimum equals the brute-force optimum on 52 small cases", () => {
    let agree = 0;
    progressions.forEach((chords, n) => {
      const window = chords.slice(0, 4);
      const cands = window.map((c) => generateVoicings(c, { maxPerChord: 6 }));
      const dp = optimiseVoicingPath(cands);
      const bf = bruteForceVoicingPath(cands);
      expect(dp.cost, `case ${n}`).toBeCloseTo(bf.cost, 9);
      expect(pathCost(dp.path)).toBeCloseTo(dp.cost, 9);
      if (Math.abs(dp.cost - bf.cost) < 1e-9) agree++;
    });
    console.log(`[voicing] DP = brute force on ${agree}/${progressions.length} cases`);
    expect(agree).toBe(progressions.length);
  });

  it("every chosen voicing on the full progressions contains the required tones", () => {
    for (const chords of progressions) {
      const { path } = optimiseVoicingPath(chords.map((c) => generateVoicings(c)));
      path.forEach((v, i) => checkVoicing(chords[i].symbol, v.frets));
    }
  });

  it("prefers staying in position", () => {
    const chords = ["C", "Am", "F", "G"].map(parseChord);
    const { path } = optimiseVoicingPath(chords.map((c) => generateVoicings(c)));
    expect(Math.max(...path.map((v) => v.position))).toBeLessThanOrEqual(3);
  });
});

describe("capo, tab", () => {
  it("capo fret = target − shape", () => {
    expect(capoFret(parseKey("A")!.tonic, parseKey("G")!.tonic)).toBe(2);
    expect(capoFret(parseKey("Eb")!.tonic, parseKey("C")!.tonic)).toBe(3);
    expect(capoFret(parseKey("F#m")!.tonic, parseKey("Em")!.tonic)).toBe(2);
    expect(capoFret(parseKey("C")!.tonic, parseKey("C")!.tonic)).toBe(0);
  });
  it("suggests open-shape keys with capo ≤ 7", () => {
    const s = capoSuggestions(parseKey("Bb")!);
    expect(s[0]).toMatchObject({ shapeName: "A", capo: 1 });
    expect(s.every((x) => x.capo <= 7)).toBe(true);
    expect(capoSuggestions(parseKey("Bm")!).map((x) => x.shapeName)).toContain("Am");
  });
  it("formats a six-line tab with high e on top", () => {
    const names = ["C", "G"];
    const path = names.map((n) => generateVoicings(parseChord(n))[0]);
    const tab = formatTab(names, path, 2).split("\n");
    expect(tab[0]).toBe("Capo 2");
    expect(tab[2].startsWith("e|0")).toBe(true);
    expect(tab[7].startsWith("E|x")).toBe(true);
  });
});

describe("Karplus–Strong synth", () => {
  it("is deterministic, bounded and decays", () => {
    const a = karplusStrong(220, 44100, 1);
    const b = karplusStrong(220, 44100, 1);
    expect(a).toEqual(b);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    expect(rms(a.slice(-4410))).toBeLessThan(rms(a.slice(0, 4410)) * 0.5);
  });

  it("is in tune (autocorrelation pitch within 0.5% for every open string)", () => {
    const sr = 44100;
    for (const midi of STANDARD_TUNING) {
      const f = midiToFrequency(midi);
      const x = karplusStrong(f, sr, 0.5).slice(2000, 2000 + 8192);
      let best = 0, bestLag = 0;
      const minLag = Math.floor(sr / (f * 1.3)), maxLag = Math.ceil(sr / (f / 1.3));
      const r: number[] = [];
      for (let lag = minLag; lag <= maxLag; lag++) {
        let s = 0;
        for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
        r[lag] = s;
        if (s > best) { best = s; bestLag = lag; }
      }
      // Parabolic interpolation around the peak.
      const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1];
      const lag = bestLag + (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
      expect(Math.abs(sr / lag - f) / f, `midi ${midi}`).toBeLessThan(0.005);
    }
  });
});
