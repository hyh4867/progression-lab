/**
 * Hand-labelled progression set for key-finding evaluation.
 *
 * Keys were assigned by ear and theory BEFORE running the algorithm (tonic = the chord the progression
 * resolves to or is built around; modal vamps are labelled with their tonic and the nearest major/minor
 * mode). Chord sequences only; well-known patterns are named generically. Entries marked `hard` are
 * deliberately included because they are known to be ambiguous for profile-based key finding
 * (modal vamps, relative-key loops, blues dominants). They are NOT removed from the accuracy figure.
 */
export interface LabelledProgression {
  id: string;
  name: string;
  chords: string;
  key: string; // "C", "Am", ...
  hard?: boolean;
  note?: string;
}

export const LABELLED_PROGRESSIONS: LabelledProgression[] = [
  { id: "axis-c", name: "Four-chord pop loop (I–V–vi–IV)", chords: "C G Am F", key: "C" },
  { id: "axis-g", name: "Four-chord pop loop in G", chords: "G D Em C G", key: "G" },
  { id: "doowop-bb", name: "Doo-wop loop (I–vi–IV–V)", chords: "Bb Gm Eb F Bb", key: "Bb" },
  { id: "251-f", name: "Jazz ii–V–I", chords: "Gm7 C7 Fmaj7 Fmaj7", key: "F" },
  { id: "251-cm", name: "Minor ii–V–i", chords: "Dm7b5 G7 Cm6 Cm6", key: "Cm" },
  { id: "blues-a", name: "12-bar blues (dominant sevenths)", chords: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7", key: "A", hard: true, note: "Blues dominant sevenths add b7 tones." },
  { id: "andalusian", name: "Andalusian cadence", chords: "Am G F E", key: "Am", hard: true, note: "Ends on V (Phrygian-sounding half cadence)." },
  { id: "canon-d", name: "Canon-style progression", chords: "D A Bm F#m G D G A D", key: "D" },
  { id: "vi-iv-i-v-am", name: "Minor-start loop (vi–IV–I–V)", chords: "Am F C G", key: "Am", hard: true, note: "Relative-key loop; labelled by its starting/framing chord." },
  { id: "fifties-e", name: "1950s ballad loop", chords: "E C#m A B7 E", key: "E" },
  { id: "royal-road-c", name: "IV–V–iii–vi loop", chords: "Fmaj7 G7 Em7 Am", key: "C", hard: true, note: "Ends on vi; heard as a major-key loop." },
  { id: "rhythm-bb", name: "Rhythm-changes-style A section", chords: "Bb G7 Cm7 F7 Bb G7 Cm7 F7 Bb Bb7 Eb Ebm Bb F7 Bb", key: "Bb" },
  { id: "circle-em", name: "Minor-key circle with ii–V", chords: "Am7 D7 Gmaj7 Cmaj7 F#m7b5 B7 Em Em", key: "Em" },
  { id: "i-iv-v-dm", name: "Natural-minor i–iv–v–i", chords: "Dm Gm Am Dm", key: "Dm" },
  { id: "harm-minor-em", name: "Harmonic-minor i–iv–V7–i", chords: "Em Am B7 Em", key: "Em" },
  { id: "mixo-d", name: "Mixolydian rock I–bVII–IV–I", chords: "D C G D", key: "D", hard: true, note: "Mixolydian; the C major chord pulls toward G." },
  { id: "aeolian-em", name: "Aeolian rock i–bVII–bVI–bVII", chords: "Em D C D Em", key: "Em" },
  { id: "gospel-c", name: "Gospel plagal rocking", chords: "C F/C C F/C C", key: "C" },
  { id: "circle-c", name: "Diatonic circle of fifths", chords: "C F Bdim Em Am Dm G C", key: "C" },
  { id: "circle-am", name: "Minor diatonic circle", chords: "Am Dm G C F Bdim E7 Am", key: "Am" },
  { id: "bossa-d", name: "Bossa-style ii–V–I", chords: "Em7 A7 Dmaj7 Bm7 Em7 A7 Dmaj7", key: "D" },
  { id: "secdom-c", name: "Secondary dominant V7/ii", chords: "C A7 Dm7 G7 C", key: "C" },
  { id: "neapolitan-cm", name: "Neapolitan cadence", chords: "Cm Db/F G7 Cm", key: "Cm" },
  { id: "picardy-am", name: "Minor phrase with Picardy third", chords: "Am Dm E7 A", key: "Am", hard: true, note: "Final chord is major (Picardy third)." },
  { id: "borrowed-iv-c", name: "Borrowed minor iv", chords: "C F Fm C", key: "C" },
  { id: "bvi-bvii-c", name: "bVI–bVII–I ending", chords: "C Ab Bb C", key: "C" },
  { id: "pop-minor-fsm", name: "Pop minor i–VI–III–VII", chords: "F#m D A E F#m", key: "F#m" },
  { id: "minor-loop-bm", name: "Minor loop i–VI–III–VII", chords: "Bm G D A Bm", key: "Bm" },
  { id: "minor-blues-cm", name: "Minor 12-bar blues", chords: "Cm7 Cm7 Cm7 Cm7 Fm7 Fm7 Cm7 Cm7 Ab7 G7 Cm7 G7", key: "Cm" },
  { id: "turnaround-eb", name: "Jazz turnaround I–vi–ii–V", chords: "Ebmaj7 Cm7 Fm7 Bb7 Ebmaj7", key: "Eb" },
  { id: "tritone-c", name: "Turnaround with tritone substitute", chords: "Cmaj7 A7 Dm7 Db7 Cmaj7", key: "C" },
  { id: "cliche-am", name: "Minor line cliché", chords: "Am Am/G# Am/G Am/F# F E7 Am", key: "Am" },
  { id: "walkdown-g", name: "Descending-bass ballad", chords: "G D/F# Em Em/D C G/B Am D G", key: "G" },
  { id: "folk-a", name: "Folk I–IV–V–I", chords: "A D E A", key: "A" },
  { id: "punk-e", name: "Three-chord rock", chords: "E A B A E", key: "E" },
  { id: "lament-dm", name: "Lament bass in minor", chords: "Dm C Bb A7 Dm", key: "Dm" },
  { id: "dorian-dm", name: "Dorian vamp i–IV", chords: "Dm7 G7 Dm7 G7", key: "Dm", hard: true, note: "Dorian; same pitch collection as C major." },
  { id: "ballad-f", name: "Pop ballad with slash chords", chords: "F C/E Dm Bb F/C C F", key: "F" },
  { id: "minor-ballad-gm", name: "Minor ballad with V7", chords: "Gm Eb Bb F D7 Gm", key: "Gm" },
  { id: "mixture-g", name: "Major key with borrowed iv", chords: "G Em Cm G", key: "G" },
  { id: "jazz-minor-gm", name: "Jazz minor ii–V–i", chords: "Am7b5 D7b9 Gm7 Gm7", key: "Gm" },
  { id: "maj7-descent-c", name: "Descending seventh chords", chords: "Fmaj7 Em7 Dm7 Cmaj7", key: "C" },
  { id: "doowop-a", name: "Doo-wop loop in A", chords: "A F#m D E A", key: "A" },
  { id: "funk-e", name: "Dominant-seventh funk vamp", chords: "E7 A7 E7 A7", key: "E", hard: true, note: "Two dominant sevenths; blues tonality." },
  { id: "ascend-cm", name: "Ascending minor i–III–iv–V", chords: "Cm Eb Fm G Cm", key: "Cm" },
  { id: "power-em", name: "Power-chord riff", chords: "E5 G5 A5 C5 E5", key: "Em", hard: true, note: "Power chords carry no thirds." },
  { id: "amen-bb", name: "Plagal 'amen' ending", chords: "Bb Eb Bb F Bb Eb Bb", key: "Bb" },
  { id: "sus-d", name: "Suspensions resolving", chords: "Dsus4 D Gsus2 G Asus4 A D", key: "D" },
  { id: "deceptive-c", name: "Deceptive then authentic cadence", chords: "C F G7 Am F G7 C", key: "C" },
  { id: "half-d", name: "Phrase ending on a half cadence", chords: "D G D A", key: "D" },
  { id: "half-am", name: "Minor phrase ending on V", chords: "Am Dm Am E", key: "Am" },
  { id: "chromatic-c", name: "Chromatic mediants", chords: "C E Am Ab G C", key: "C" },
];
