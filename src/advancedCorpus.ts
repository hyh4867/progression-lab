/**
 * Advanced labelled set (v2). Expected devices and functions were written BEFORE the v2 analyser was
 * implemented (see git history: this file was committed before lib/progression/analysis.ts changed).
 * Chord sequences only; generic names.
 *
 * Device tags:
 *   aug6-it / aug6-fr / aug6-ger   augmented sixths          neapolitan       bII / N6
 *   aug-dominant                   V+ (augmented dominant)   passing-aug      chromatic passing I+
 *   mediant-aug                    III+ (harmonic minor)     ct-dim7          common-tone dim7
 *   leading-tone-dim7              vii°7/x                   passing-dim      passing diminished
 *   chromatic-mediant              third-related chromatic triad
 *   mixture:<mode>                 modal interchange from aeolian / dorian / mixolydian / lydian / phrygian /
 *                                  ionian / harmonic-minor / melodic-minor
 *   picardy                        major tonic in a minor key
 *   altered-dominant / suspended-dominant / secondary-dominant / tritone-sub / backdoor-dominant
 *   blues-dominant / inferred
 * Span tags: pedal, line-cliche, lament, mixolydian-vamp, dorian-vamp, coltrane-cycle
 * Region expectations: ordered list of region keys that must appear; "modulation", "pivot", "no-modulation".
 */
/** v2 functions: T, PD, D and PASS (passing / embellishing). */
export type ExpectedFunction = "T" | "PD" | "D" | "PASS";

export interface ChordExpectation {
  index: number;
  device?: string;
  fn?: ExpectedFunction;
}

export interface AdvancedLabelled {
  id: string;
  name: string;
  chords: string;
  key: string;
  chordsExpect: ChordExpectation[];
  spans?: string[];
  regions?: { keys?: string[]; flags?: ("modulation" | "pivot" | "no-modulation")[] };
}

export const ADVANCED_PROGRESSIONS: AdvancedLabelled[] = [
  { id: "ger6", name: "German sixth to V", chords: "C Ab7 G7 C", key: "C", chordsExpect: [{ index: 1, device: "aug6-ger", fn: "PD" }, { index: 2, fn: "D" }] },
  { id: "ger6-cad64", name: "German sixth via cadential 6-4", chords: "C Fm Ab7 C/G G7 C", key: "C", chordsExpect: [{ index: 1, device: "mixture:aeolian", fn: "PD" }, { index: 2, device: "aug6-ger", fn: "PD" }] },
  { id: "ger6-pop", name: "Pop-spelled German sixth to I6/4", chords: "C Ab7 C/G G7 C", key: "C", chordsExpect: [{ index: 1, device: "aug6-ger", fn: "PD" }] },
  { id: "fr6-minor", name: "French sixth in minor", chords: "Am Dm F7b5 E7 Am", key: "Am", chordsExpect: [{ index: 2, device: "aug6-fr", fn: "PD" }, { index: 3, fn: "D" }] },
  { id: "fr6-slash", name: "French sixth spelled as a slash chord", chords: "C D7b5/Ab G C", key: "C", chordsExpect: [{ index: 1, device: "aug6-fr", fn: "PD" }] },
  { id: "it6", name: "Italian sixth", chords: "Cm Ab7(no5) G Cm", key: "Cm", chordsExpect: [{ index: 1, device: "aug6-it", fn: "PD" }] },
  { id: "n6", name: "Neapolitan sixth", chords: "Am Bb/D E7 Am", key: "Am", chordsExpect: [{ index: 1, device: "neapolitan", fn: "PD" }, { index: 2, fn: "D" }] },
  { id: "n-root", name: "Root-position Neapolitan", chords: "Cm Db G7 Cm", key: "Cm", chordsExpect: [{ index: 1, device: "neapolitan", fn: "PD" }] },
  { id: "phrygian-vamp", name: "Phrygian i–bII vamp", chords: "Em F Em F Em", key: "Em", chordsExpect: [{ index: 1, device: "mixture:phrygian", fn: "PD" }] },
  { id: "aug-dom", name: "Augmented dominant", chords: "C F G+ C", key: "C", chordsExpect: [{ index: 2, device: "aug-dominant", fn: "D" }] },
  { id: "aug-dom-respelled", name: "Augmented dominant written on another root", chords: "C Dm7 Eb+ C", key: "C", chordsExpect: [{ index: 2, device: "aug-dominant", fn: "D" }] },
  { id: "aug-cliche", name: "Ascending I–I+–I6–I7", chords: "C C+ C6 C7 F", key: "C", chordsExpect: [{ index: 1, device: "passing-aug", fn: "PASS" }, { index: 3, device: "secondary-dominant", fn: "D" }], spans: ["line-cliche"] },
  { id: "aug-to-iv", name: "Passing I+ to IV, borrowed iv", chords: "C C+ F Fm C", key: "C", chordsExpect: [{ index: 1, device: "passing-aug", fn: "PASS" }, { index: 3, device: "mixture:aeolian", fn: "PD" }] },
  { id: "iii-aug", name: "III+ in harmonic minor", chords: "Am C+ Dm E7 Am", key: "Am", chordsExpect: [{ index: 1, device: "mediant-aug", fn: "D" }] },
  { id: "ct-dim7", name: "Common-tone diminished seventh on I", chords: "C Cdim7 C G7 C", key: "C", chordsExpect: [{ index: 1, device: "ct-dim7", fn: "PASS" }] },
  { id: "ct-dim7-sharp-ii", name: "Common-tone #ii°7", chords: "C D#dim7 C F G7 C", key: "C", chordsExpect: [{ index: 1, device: "ct-dim7", fn: "PASS" }] },
  { id: "passing-dim-up", name: "Ascending passing diminished", chords: "C C#dim7 Dm7 G7 C", key: "C", chordsExpect: [{ index: 1, device: "passing-dim", fn: "D" }] },
  { id: "passing-dim-down", name: "Descending passing diminished", chords: "C Dm7 Dbdim7 C/E F G7 C", key: "C", chordsExpect: [{ index: 2, device: "passing-dim", fn: "PASS" }] },
  { id: "lt-dim7-v", name: "Leading-tone diminished seventh of V", chords: "C F#dim7 G C", key: "C", chordsExpect: [{ index: 1, device: "leading-tone-dim7", fn: "D" }] },
  { id: "mediant-major", name: "Chromatic mediant III", chords: "C E F G C", key: "C", chordsExpect: [{ index: 1, device: "chromatic-mediant", fn: "T" }] },
  { id: "mediant-flat-minor", name: "Doubly chromatic mediant", chords: "C Abm C", key: "C", chordsExpect: [{ index: 1, device: "chromatic-mediant", fn: "T" }] },
  { id: "mediant-film", name: "Mediant chain", chords: "C E Ab C", key: "C", chordsExpect: [{ index: 1, device: "chromatic-mediant", fn: "T" }, { index: 2, device: "mixture:aeolian" }] },
  { id: "mixolydian-vamp", name: "Mixolydian I–bVII–IV", chords: "D C G D", key: "D", chordsExpect: [{ index: 1, device: "mixture:mixolydian", fn: "D" }], spans: ["mixolydian-vamp"] },
  { id: "mario", name: "bVI–bVII–I", chords: "C Ab Bb C", key: "C", chordsExpect: [{ index: 1, device: "mixture:aeolian", fn: "PD" }, { index: 2, device: "mixture:aeolian", fn: "D" }] },
  { id: "lydian", name: "Lydian I–II", chords: "C D C D C", key: "C", chordsExpect: [{ index: 1, device: "mixture:lydian" }] },
  { id: "dorian-vamp", name: "Dorian i–IV vamp", chords: "Am D Am D", key: "Am", chordsExpect: [{ index: 1, device: "mixture:dorian", fn: "PD" }], spans: ["dorian-vamp"] },
  { id: "dorian-ii", name: "Dorian ii in minor", chords: "Cm Dm7 G7 Cm", key: "Cm", chordsExpect: [{ index: 1, device: "mixture:dorian", fn: "PD" }] },
  { id: "picardy", name: "Picardy third", chords: "Dm Gm A7 D", key: "Dm", chordsExpect: [{ index: 3, device: "picardy", fn: "T" }] },
  { id: "altered-b9", name: "Altered dominant (b9)", chords: "Dm7 G7b9 Cmaj7", key: "C", chordsExpect: [{ index: 1, device: "altered-dominant", fn: "D" }] },
  { id: "altered-alt", name: "7alt dominant in minor", chords: "Fmaj7 E7alt Am", key: "Am", chordsExpect: [{ index: 1, device: "altered-dominant", fn: "D" }] },
  { id: "sus-dominant", name: "Suspended dominant", chords: "C F G7sus4 G7 C", key: "C", chordsExpect: [{ index: 2, device: "suspended-dominant", fn: "D" }] },
  { id: "extended-secondary", name: "Extensions keep the function", chords: "C A13 Dm9 G13 C", key: "C", chordsExpect: [{ index: 1, device: "secondary-dominant", fn: "D" }, { index: 3, fn: "D" }] },
  { id: "tonic-pedal", name: "Tonic pedal", chords: "C F/C G/C C", key: "C", chordsExpect: [], spans: ["pedal"] },
  { id: "dominant-pedal", name: "Dominant pedal", chords: "C G Dm/G C/G G7 C", key: "C", chordsExpect: [], spans: ["pedal"] },
  { id: "minor-cliche", name: "Minor line cliché i–i(maj7)–i7–i6", chords: "Cm CmMaj7 Cm7 Cm6 Fm", key: "Cm", chordsExpect: [{ index: 1, fn: "T" }], spans: ["line-cliche"] },
  { id: "lament-chromatic", name: "Chromatic descending bass", chords: "Am Am/G# C/G D/F# Fmaj7 E", key: "Am", chordsExpect: [], spans: ["lament"] },
  { id: "lament-diatonic", name: "Descending minor tetrachord", chords: "Dm C Bb A7", key: "Dm", chordsExpect: [], spans: ["lament"] },
  { id: "coltrane", name: "Major-third key cycle", chords: "B D7 G Bb7 Eb F#7 B", key: "B", chordsExpect: [], spans: ["coltrane-cycle"], regions: { keys: ["B", "G", "Eb"] } },
  { id: "modulation-c-g", name: "Modulation to the dominant", chords: "C F G7 C Am D7 G Em Am D7 G", key: "C", chordsExpect: [], regions: { keys: ["C", "G"], flags: ["modulation", "pivot"] } },
  { id: "tonicisation-only", name: "Applied chord without modulation", chords: "C A7 Dm7 G7 C", key: "C", chordsExpect: [{ index: 1, device: "secondary-dominant", fn: "D" }], regions: { flags: ["no-modulation"] } },
  { id: "backdoor", name: "Backdoor ii–V", chords: "C Fm7 Bb7 C", key: "C", chordsExpect: [{ index: 1, device: "mixture:aeolian", fn: "PD" }, { index: 2, device: "backdoor-dominant", fn: "D" }] },
  { id: "tritone", name: "Tritone substitute", chords: "Dm7 Db7 Cmaj7", key: "C", chordsExpect: [{ index: 1, device: "tritone-sub", fn: "D" }] },
  { id: "inferred", name: "Unlabelled chromatic chord", chords: "C F#m B7 Em", key: "C", chordsExpect: [{ index: 1, device: "inferred" }] },
  { id: "blues", name: "Blues dominants", chords: "A7 D7 A7 E7 D7 A7", key: "A", chordsExpect: [{ index: 1, device: "blues-dominant", fn: "PD" }, { index: 3, fn: "D" }] },
];
