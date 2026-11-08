/**
 * Named progression library (v2).
 *
 * Song references are title + artist only (no lyrics, melodies or audio). Every kept example was checked
 * against a web source on 2026-11-08 that states the song uses the progression in at least one section
 * (possibly transposed or varied); the URL is stored in `sources`. Examples that could not be verified are
 * listed in DROPPED_EXAMPLES and are never shown. Each entry shows at most two well-known songs; other
 * verified examples are listed in TRIMMED_EXAMPLES. Entry-level `sources` are not shown in the UI.
 */

export type LibraryCategory = "Pop/Rock" | "Jazz" | "Blues" | "Classical" | "Modal" | "Film/Game";
export type LibraryLevel = "basic" | "intermediate" | "advanced";

export interface SongExample {
  title: string;
  artist: string;
  where: string; // "verse", "intro", "coda", "A section", ...
  transposed?: boolean; // the recording is in another key than the default chords
  note?: string;
  sources: string[];
}

export interface LibraryEntry {
  id: string;
  name: string;
  aka: string[];
  category: LibraryCategory;
  level: LibraryLevel;
  featured?: boolean;
  numerals: string;
  chords: string; // default key; "|" bar lines allowed
  key: string;
  why: string;
  /** Device tags the analysis must contain (chord tags, span types, "cadence:<type>"). */
  expectedDevices: string[];
  examples: SongExample[];
  /** Where the progression is heard when no specific song is listed. */
  context?: string;
  sources: string[];
}

const W = (t: string) => "https://en.wikipedia.org/wiki/" + t;

export const LIBRARY: LibraryEntry[] = [
  {
    id: "axis", name: "I–V–vi–IV", aka: ["Axis progression", "pop-punk progression"], category: "Pop/Rock", level: "basic", featured: true,
    numerals: "I – V – vi – IV", chords: "C G Am F", key: "C",
    why: "All four chords are diatonic and share tones pairwise, so the loop moves smoothly; V→vi is a built-in deceptive move that keeps it circling.",
    expectedDevices: ["cadence:deceptive"],
    examples: [
      { title: "Let It Be", artist: "The Beatles", where: "verse", sources: ["https://richterguitar.com/let-it-be-the-beatles/", "https://www.pianote.com/blog/?p=15413"] },
      { title: "With or Without You", artist: "U2", where: "throughout", transposed: true, sources: [W("With_or_Without_You")] },
    ],
    sources: [W("I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression")],
  },
  {
    id: "vi-iv-i-v", name: "vi–IV–I–V", aka: ["minor-start four-chord loop"], category: "Pop/Rock", level: "basic",
    numerals: "vi – IV – I – V", chords: "Am F C G", key: "C",
    why: "The axis loop started on vi: the same four chords, but beginning on the minor chord gives a darker, more urgent colour.",
    expectedDevices: ["diatonic"],
    examples: [
      { title: "Zombie", artist: "The Cranberries", where: "main progression", transposed: true, sources: [W("I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression")] },
      { title: "Despacito", artist: "Luis Fonsi", where: "main progression", transposed: true, sources: [W("Despacito"), W("I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression")] },
    ],
    sources: [W("I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression")],
  },
  {
    id: "fifties", name: "I–vi–IV–V", aka: ["'50s progression", "doo-wop changes"], category: "Pop/Rock", level: "basic", featured: true,
    numerals: "I – vi – IV – V", chords: "C Am F G", key: "C",
    why: "Tonic, its relative minor, a predominant and the dominant: one full functional cycle (T–T–PD–D) that ends on V and pulls straight back to I.",
    expectedDevices: ["cadence:half"],
    examples: [
      { title: "Stand by Me", artist: "Ben E. King", where: "main progression", transposed: true, sources: [W("%2750s_progression")] },
      { title: "Every Breath You Take", artist: "The Police", where: "main progression", transposed: true, sources: [W("%2750s_progression")] },
    ],
    sources: [W("%2750s_progression")],
  },
  {
    id: "canon", name: "Canon progression", aka: ["Pachelbel progression"], category: "Classical", level: "basic", featured: true,
    numerals: "I – V – vi – iii – IV – I – IV – V", chords: "D A Bm F#m G D G A", key: "D",
    why: "A descending bass (D–C#–B–A–G–F#–G–A) under chords a fourth apart; each chord shares a tone with the next, so it can repeat for ever.",
    expectedDevices: ["cadence:deceptive", "cadence:half"],
    examples: [
      { title: "Canon in D", artist: "Johann Pachelbel", where: "throughout (ground bass)", sources: [W("Pachelbel%27s_Canon")] },
      { title: "Memories", artist: "Maroon 5", where: "throughout", transposed: true, sources: [W("Memories_(Maroon_5_song)"), W("Pachelbel%27s_Canon")] },
    ],
    sources: [W("Pachelbel%27s_Canon")],
  },
  {
    id: "ii-v-i", name: "ii–V–I", aka: ["two-five-one"], category: "Jazz", level: "intermediate", featured: true,
    numerals: "ii7 – V7 – Imaj7", chords: "Dm7 G7 Cmaj7", key: "C",
    why: "Predominant → dominant → tonic with roots falling by fifths; the 7ths resolve down by step into the next chord's 3rd.",
    expectedDevices: ["cadence:authentic"],
    examples: [
      { title: "Autumn Leaves", artist: "Joseph Kosma (jazz standard)", where: "throughout", transposed: true, sources: [W("Autumn_Leaves_(1945_song)")] },
    ],
    sources: [W("Ii%E2%80%93V%E2%80%93I_progression")],
  },
  {
    id: "circle", name: "Diatonic circle of fifths", aka: ["circle progression"], category: "Jazz", level: "intermediate",
    numerals: "Imaj7 – IVmaj7 – viiø7 – iii7 – vi7 – ii7 – V7 – Imaj7", chords: "Cmaj7 Fmaj7 Bm7b5 Em7 Am7 Dm7 G7 Cmaj7", key: "C",
    why: "Every root falls a fifth (one diminished fifth, F–B, keeps it inside the key), so each chord prepares the next like a chain of small cadences.",
    expectedDevices: ["cadence:authentic"],
    examples: [
      { title: "Fly Me to the Moon", artist: "Bart Howard (jazz standard)", where: "A section", note: "Am7–Dm7–G7–Cmaj7 segment", sources: ["https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/circle-of-fifths/"] },
      { title: "I Will Survive", artist: "Gloria Gaynor", where: "throughout", transposed: true, note: "minor-key version (Am–Dm–G–Cmaj7–Fmaj7–Bm7b5–E)", sources: ["https://tabs.ultimate-guitar.com/tab/gloria-gaynor/i-will-survive-chords-991389", "https://hooktheory.com/theorytab/view/gloria-gaynor/i-will-survive"] },
    ],
    sources: [W("Vi%E2%80%93ii%E2%80%93V%E2%80%93I")],
  },
  {
    id: "twelve-bar", name: "12-bar blues", aka: ["blues changes"], category: "Blues", level: "basic", featured: true,
    numerals: "I7 – IV7 – I7 – I7 – IV7 – IV7 – I7 – I7 – V7 – IV7 – I7 – V7", chords: "A7 | D7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7", key: "A",
    why: "Three dominant-seventh chords in a fixed 12-bar frame; the b7s are blues colour rather than tensions that must resolve, and bar 12's V7 turns the form around.",
    expectedDevices: ["blues-dominant"],
    examples: [
      { title: "Johnny B. Goode", artist: "Chuck Berry", where: "verse", transposed: true, sources: ["https://theartofrockmusic.voices.wooster.edu/wp-content/uploads/sites/180/2015/01/Johnny-B.-Goode-Chuck-Berry-1958.pdf"] },
      { title: "Hound Dog", artist: "Big Mama Thornton / Elvis Presley", where: "throughout", transposed: true, sources: [W("Hound_Dog_(song)")] },
    ],
    sources: [W("Twelve-bar_blues")],
  },
  {
    id: "minor-blues", name: "Minor blues", aka: [], category: "Blues", level: "intermediate",
    numerals: "i7 – iv7 – i7 – bVI7 – V7 – i7", chords: "Bm7 | Bm7 | Bm7 | Bm7 | Em7 | Em7 | Bm7 | Bm7 | G7 | F#7 | Bm7 | F#7", key: "Bm",
    why: "The 12-bar frame in a minor key; bar 9's bVI7 slides down a half step to V7, which has the pitch content of a German augmented sixth.",
    expectedDevices: ["aug6-ger"],
    examples: [
      { title: "The Thrill Is Gone", artist: "B.B. King", where: "throughout", sources: [W("The_Thrill_Is_Gone")] },
    ],
    sources: [W("The_Thrill_Is_Gone")],
  },
  {
    id: "bird-blues", name: "Bird blues", aka: ["Parker blues"], category: "Jazz", level: "advanced",
    numerals: "Imaj7 – viiø7 III7 – vi7 II7 – v7 I7 – IV7 – iv7 bVII7 – iii7 VI7 – biii7 bVI7 – ii7 – V7 – I VI7 – ii7 V7", chords: "Fmaj7 | Em7b5 A7 | Dm7 G7 | Cm7 F7 | Bb7 | Bbm7 Eb7 | Am7 D7 | Abm7 Db7 | Gm7 | C7 | Fmaj7 D7 | Gm7 C7", key: "F",
    why: "A 12-bar blues rebuilt from chains of ii–V pairs that descend by step, so the harmony moves on almost every beat.",
    expectedDevices: ["secondary-dominant"],
    examples: [
      { title: "Blues for Alice", artist: "Charlie Parker", where: "throughout", sources: [W("Blues_for_Alice")] },
    ],
    sources: [W("Blues_for_Alice")],
  },
  {
    id: "rhythm-changes", name: "Rhythm changes (A section)", aka: ["I Got Rhythm changes"], category: "Jazz", level: "advanced",
    numerals: "I VI7 – ii7 V7 – I VI7 – ii7 V7 – I I7 – IV iv – I V7 – I", chords: "Bb G7 | Cm7 F7 | Bb G7 | Cm7 F7 | Bb Bb7 | Eb Ebm | Bb F7 | Bb", key: "Bb",
    why: "Repeated I–vi–ii–V turnarounds with applied dominants, then I7→IV and the borrowed iv for a bittersweet turn back to the tonic.",
    expectedDevices: ["secondary-dominant", "mixture:aeolian"],
    examples: [
      { title: "I Got Rhythm", artist: "George Gershwin", where: "throughout", sources: [W("Rhythm_changes")] },
      { title: "Meet the Flintstones (theme)", artist: "Hoyt Curtin", where: "throughout", sources: [W("Rhythm_changes")] },
    ],
    sources: [W("Rhythm_changes")],
  },
  {
    id: "andalusian", name: "Andalusian cadence", aka: ["i–bVII–bVI–V"], category: "Pop/Rock", level: "basic", featured: true,
    numerals: "i – VII – VI – V", chords: "Am | G | F | E", key: "Am",
    why: "Four chords step down the minor scale to a major V, whose raised leading tone makes the loop sound like a half cadence (Phrygian colour).",
    expectedDevices: ["cadence:half", "lament"],
    examples: [
      { title: "Hit the Road Jack", artist: "Ray Charles", where: "throughout", transposed: true, sources: [W("Andalusian_cadence")] },
      { title: "Runaway", artist: "Del Shannon", where: "verse", transposed: true, sources: [W("Andalusian_cadence")] },
    ],
    sources: [W("Andalusian_cadence")],
  },
  {
    id: "mixolydian", name: "Mixolydian I–bVII–IV", aka: ["Mixolydian vamp"], category: "Modal", level: "intermediate", featured: true,
    numerals: "I – bVII – IV – I", chords: "D C G D", key: "D",
    why: "bVII replaces V, so the loop never uses the leading tone; IV and bVII are both a whole step from their neighbours, giving a relaxed rock sound.",
    expectedDevices: ["mixolydian-vamp", "mixture:mixolydian"],
    examples: [
      { title: "Sweet Child o' Mine", artist: "Guns N' Roses", where: "verse", sources: [W("Mixolydian_mode")] },
      { title: "Hey Jude", artist: "The Beatles", where: "coda", transposed: true, sources: [W("Hey_Jude")] },
    ],
    sources: [W("Mixolydian_mode")],
  },
  {
    id: "mario", name: "bVI–bVII–I", aka: ["Mario cadence", "Aeolian cadence"], category: "Film/Game", level: "intermediate", featured: true,
    numerals: "I – bVI – bVII – I", chords: "C Ab Bb C", key: "C",
    why: "Two major chords borrowed from the parallel minor rise by whole steps into the tonic: a triumphant cadence with no V chord.",
    expectedDevices: ["mixture:aeolian"],
    examples: [
      { title: "Super Mario Bros. (level-clear fanfare)", artist: "Koji Kondo", where: "fanfare", sources: [W("Backdoor_progression")] },
      { title: "Lady Madonna", artist: "The Beatles", where: "intro", transposed: true, sources: ["https://beatlessongwriting.blogspot.com/2024/09/ticket-1-flat-six.html"] },
    ],
    sources: [W("Backdoor_progression")],
  },
  {
    id: "creep", name: "I–III–IV–iv", aka: [], category: "Pop/Rock", level: "intermediate",
    numerals: "I – III – IV – iv", chords: "G B C Cm", key: "G",
    why: "A major III and a borrowed minor iv create a chromatic inner line (D–D#–E–Eb) that creeps up and back down.",
    expectedDevices: ["chromatic-mediant", "mixture:aeolian"],
    examples: [
      { title: "Creep", artist: "Radiohead", where: "throughout", sources: [W("Creep_(Radiohead_song)")] },
    ],
    sources: [W("Creep_(Radiohead_song)")],
  },
  {
    id: "aeolian-vamp", name: "Aeolian vamp", aka: ["i–bVII–bVI–bVII"], category: "Modal", level: "intermediate",
    numerals: "i – VII – VI – VII", chords: "Am G F G", key: "Am",
    why: "The natural-minor chords rock back and forth without a leading tone, so the loop never resolves and keeps its brooding drive.",
    expectedDevices: ["diatonic"],
    examples: [
      { title: "All Along the Watchtower", artist: "Bob Dylan / Jimi Hendrix", where: "throughout", transposed: true, sources: ["https://chordna.web.app/song/jimi_hendrix_all_along_the_watchtower", "https://www.licklibrary.com/learn/lessons/jimi-hendrix/all-along-the-watchtower"] },
    ],
    sources: [W("All_Along_the_Watchtower")],
  },
  {
    id: "three-chord", name: "I–IV–V", aka: ["three-chord song"], category: "Pop/Rock", level: "basic",
    numerals: "I – IV – V – IV", chords: "C F G F", key: "C",
    why: "The three primary chords cover every note of the major scale: tonic, predominant and dominant in their simplest form.",
    expectedDevices: ["diatonic"],
    examples: [
      { title: "La Bamba", artist: "Ritchie Valens", where: "throughout", sources: ["https://nationalguitaracademy.com/?p=15505"] },
      { title: "Twist and Shout", artist: "The Isley Brothers / The Beatles", where: "verse", transposed: true, sources: ["https://richterguitar.com/twist-and-shout-the-beatles/"] },
    ],
    sources: [W("Three-chord_song")],
  },
  {
    id: "dorian", name: "Dorian i–IV vamp", aka: [], category: "Modal", level: "intermediate",
    numerals: "i7 – IV7", chords: "Am7 D7 Am7 D7", key: "Am",
    why: "The major IV carries the Dorian raised sixth, so the minor tonic sounds bright and funky instead of sad.",
    expectedDevices: ["dorian-vamp", "mixture:dorian"],
    examples: [
      { title: "Oye Como Va", artist: "Santana", where: "throughout", sources: [W("Dorian_mode")] },
    ],
    sources: [W("Dorian_mode")],
  },
  {
    id: "phrygian", name: "Phrygian i–bII vamp", aka: [], category: "Modal", level: "intermediate",
    numerals: "i – bII", chords: "Em F Em F", key: "Em",
    why: "bII sits a half step above the tonic and falls straight back to it: the Phrygian half step heard in flamenco and in bolero-style rock.",
    expectedDevices: ["mixture:phrygian"],
    examples: [
      { title: "White Rabbit", artist: "Jefferson Airplane", where: "intro / verse", transposed: true, note: "major tonic chord (F#–G)", sources: ["https://hooktheory.com/theorytab/view/jefferson-airplane/white-rabbit", "https://theartofrockmusic.voices.wooster.edu/wp-content/uploads/sites/180/2015/01/White-Rabbit-Jefferson-Airplane-1967-1.pdf"] },
    ],
    sources: [W("Phrygian_mode")],
  },
  {
    id: "minor-cliche", name: "Minor line cliché", aka: ["i–i(maj7)–i7–i6"], category: "Jazz", level: "intermediate",
    numerals: "i – i(maj7) – i7 – i6", chords: "Cm CmMaj7 Cm7 Cm6", key: "Cm",
    why: "The chord stays put while one voice descends chromatically (C–B–Bb–A), creating motion over a single harmony.",
    expectedDevices: ["line-cliche"],
    examples: [
      { title: "My Funny Valentine", artist: "Rodgers & Hart", where: "opening", sources: ["https://www.jazzguitar.be/blog/10-ways-to-play-my-funny-valentine-chord-changes/"] },
      { title: "Michelle", artist: "The Beatles", where: "intro", transposed: true, sources: ["https://guitarnoise.forum/guitar-and-music-theory/michelle-ma-belle/", "https://beatlessongwriting.blogspot.com/2016/08/golden-ticket-chromatic-descent.html"] },
    ],
    sources: ["https://www.thejazzpianosite.com/jazz-piano-lessons/jazz-chord-progressions/line-cliches/"],
  },
  {
    id: "lament", name: "Chromatic lament bass", aka: ["descending chromatic bass"], category: "Classical", level: "intermediate",
    numerals: "i – i/^#7 – III/^5 – IV/^#4 – VI", chords: "Am Am/G# C/G D/F# Fmaj7", key: "Am",
    why: "The bass falls by half steps from the tonic toward the dominant, an old lament figure; the chords above simply follow the line.",
    expectedDevices: ["lament"],
    examples: [
      { title: "Stairway to Heaven", artist: "Led Zeppelin", where: "intro", sources: [W("Stairway_to_Heaven")] },
      { title: "Dido's Lament", artist: "Henry Purcell", where: "ground bass", transposed: true, sources: [W("Lament_bass"), W("Dido%27s_Lament")] },
    ],
    sources: [W("Lament_bass")],
  },
  {
    id: "ragtime", name: "Ragtime progression", aka: ["VI7–II7–V7–I"], category: "Jazz", level: "intermediate",
    numerals: "VI7 – II7 – V7 – I", chords: "E7 A7 D7 G", key: "G",
    why: "A chain of secondary dominants: each dominant seventh resolves a fifth down into the next, ending on the tonic.",
    expectedDevices: ["secondary-dominant", "cadence:authentic"],
    examples: [
      { title: "Sweet Georgia Brown", artist: "Ben Bernie & Maceo Pinkard", where: "A section", transposed: true, sources: [W("Sweet_Georgia_Brown"), W("Ragtime_progression")] },
    ],
    sources: [W("Ragtime_progression")],
  },
  {
    id: "just-the-two", name: "IVmaj7–III7–vi7–v7–I7", aka: ["\"Just the Two of Us\" progression"], category: "Jazz", level: "advanced",
    numerals: "IVmaj7 – III7 – vi7 – v7 I7", chords: "Dbmaj7 C7 Fm7 Ebm7 Ab7", key: "Ab",
    why: "III7 is the secondary dominant of vi, and the minor v7–I7 pair is a ii–V into IV that restarts the loop.",
    expectedDevices: ["secondary-dominant"],
    examples: [
      { title: "Just the Two of Us", artist: "Grover Washington Jr. & Bill Withers", where: "intro / verse", sources: [W("Just_the_Two_of_Us_(Grover_Washington_Jr._song)")] },
    ],
    sources: [W("Just_the_Two_of_Us_(Grover_Washington_Jr._song)")],
  },
  {
    id: "coltrane", name: "Coltrane changes", aka: ["Giant Steps cycle", "major-third cycle"], category: "Jazz", level: "advanced",
    numerals: "I – V7/bVI – bVI – V7/III – III – V7 – I", chords: "B D7 G Bb7 Eb F#7 B", key: "B",
    why: "Three key centres a major third apart (B, G, Eb) divide the octave equally, each reached through its own V7.",
    expectedDevices: ["coltrane-cycle"],
    examples: [
      { title: "Giant Steps", artist: "John Coltrane", where: "throughout", sources: [W("Coltrane_changes")] },
    ],
    sources: [W("Coltrane_changes")],
  },
  {
    id: "backdoor", name: "Backdoor ii–V", aka: ["iv7–bVII7–I"], category: "Jazz", level: "advanced",
    numerals: "iv7 – bVII7 – Imaj7", chords: "Cmaj7 Fm7 Bb7 Cmaj7", key: "C",
    why: "Borrowed iv7 and bVII7 approach the tonic from a whole step below instead of from V: a soft, surprising resolution.",
    expectedDevices: ["backdoor-dominant"],
    examples: [
      { title: "Lady Bird", artist: "Tadd Dameron", where: "bars 3–4", sources: ["https://www.jazz-guitar-licks.com/blog/lessons/what-is-a-backdoor-progression-and-how-to-play-over-it.html"] },
    ],
    sources: [W("Backdoor_progression")],
  },
  {
    id: "neapolitan", name: "Neapolitan sixth", aka: ["N6"], category: "Classical", level: "advanced",
    numerals: "i – N6 – V7 – i", chords: "Cm Db/F G7 Cm", key: "Cm",
    why: "A major chord on the lowered second degree, usually with the 4th degree in the bass, falls to the leading tone as it moves to V.",
    expectedDevices: ["neapolitan"],
    examples: [
      { title: "Piano Sonata No. 14 \"Moonlight\", 1st mvt", artist: "Ludwig van Beethoven", where: "opening", transposed: true, sources: [W("Neapolitan_chord")] },
    ],
    sources: [W("Neapolitan_chord")],
  },
  // ---------------- entries without song examples (context instead) ----------------
  {
    id: "royal-road", name: "Royal Road", aka: ["IV–V–iii–vi", "王道進行"], category: "Pop/Rock", level: "intermediate",
    numerals: "IVmaj7 – V7 – iii7 – vi", chords: "Fmaj7 G7 Em7 Am", key: "C",
    why: "Predominant to dominant, then a deceptive sidestep to iii and vi instead of the tonic: hopeful but unresolved.",
    expectedDevices: ["diatonic"], examples: [], context: "Very common in J-pop and anime songs.", sources: [W("Royal_road_progression")],
  },
  {
    id: "aug6", name: "Augmented sixth to V", aka: ["German sixth"], category: "Classical", level: "advanced",
    numerals: "I – Ger+6 – I6/4 – V7 – I", chords: "C Ab7 C/G G7 C", key: "C",
    why: "b6 and #4 form an augmented sixth that expands outward by half steps to the dominant octave.",
    expectedDevices: ["aug6-ger"], examples: [], context: "Classical music and film scores.", sources: [W("Augmented_sixth_chord")],
  },
  {
    id: "aug-ascending", name: "Ascending I–I+–I6–I7", aka: ["major line cliché"], category: "Pop/Rock", level: "advanced",
    numerals: "I – I+ – I6 – I7 – IV", chords: "C C+ C6 C7 F", key: "C",
    why: "The fifth rises chromatically (G–G#–A–Bb) over a held tonic, turning I into a secondary dominant of IV.",
    expectedDevices: ["passing-aug", "line-cliche"], examples: [], context: "Show tunes and 1960s pop ballads.", sources: [W("Chromaticism")],
  },
  {
    id: "mediants", name: "Chromatic mediants", aka: ["third relations"], category: "Film/Game", level: "advanced",
    numerals: "I – III – I", chords: "C E C", key: "C",
    why: "Major chords a third apart share one tone while the others shift by half steps: a vivid colour change with no functional pull.",
    expectedDevices: ["chromatic-mediant"], examples: [], context: "Film scores.", sources: [W("Chromatic_mediant")],
  },
  {
    id: "ct-dim7", name: "Common-tone diminished seventh", aka: ["ct°7"], category: "Jazz", level: "advanced",
    numerals: "I – ct°7 – I", chords: "C D#dim7 C", key: "C",
    why: "The diminished chord keeps the tonic's root while the other voices step away and back: decoration, not a new function.",
    expectedDevices: ["ct-dim7"], examples: [], context: "Ragtime, show tunes and jazz standards.", sources: [W("Common_tone_(chord)")],
  },
  {
    id: "picardy", name: "Picardy third", aka: [], category: "Classical", level: "intermediate",
    numerals: "i – iv – V7 – I", chords: "Dm Gm A7 D", key: "Dm",
    why: "A minor-key phrase ends on a major tonic, borrowed from the parallel major for a bright final chord.",
    expectedDevices: ["picardy"], examples: [], context: "Baroque chorales.", sources: [W("Picardy_third")],
  },
  {
    id: "amen", name: "Plagal \"Amen\" cadence", aka: ["IV–I"], category: "Classical", level: "basic",
    numerals: "I – IV – I", chords: "C F C", key: "C",
    why: "IV to I resolves without a leading tone: a soft, settled ending.",
    expectedDevices: ["cadence:plagal"], examples: [], context: "Hymns.", sources: [W("Plagal_cadence")],
  },
  {
    id: "deceptive", name: "Deceptive cadence", aka: ["V–vi"], category: "Classical", level: "basic",
    numerals: "I – IV – V7 – vi", chords: "C F G7 Am", key: "C",
    why: "The dominant sets up the tonic, then lands on vi, which shares two of its tones: expectation without arrival.",
    expectedDevices: ["cadence:deceptive"], examples: [], context: "Everywhere from Bach to pop ballads, to extend a phrase.", sources: [W("Cadence")],
  },
  {
    id: "lydian", name: "Lydian I–II", aka: [], category: "Modal", level: "intermediate",
    numerals: "I – II", chords: "C D C D", key: "C",
    why: "The major II carries the raised fourth of the Lydian mode, a floating, dreamy colour that does not need to resolve.",
    expectedDevices: ["mixture:lydian"], examples: [], context: "Film and game scores, dream-pop.", sources: [W("Lydian_mode")],
  },
  {
    id: "tonic-pedal", name: "Tonic pedal", aka: ["pedal point"], category: "Classical", level: "intermediate",
    numerals: "I – IV6/4 – V/^1 – I", chords: "C F/C G/C C", key: "C",
    why: "The bass holds the tonic while chords above change, so even the dominant is heard as decoration of the held note.",
    expectedDevices: ["pedal"], examples: [], context: "Organ music, intros and endings in rock and pop.", sources: [W("Pedal_point")],
  },
];

/** Examples that could not be verified with a web source and were therefore dropped (never shown). */
export const DROPPED_EXAMPLES: { entry: string; title: string; artist: string; reason: string }[] = [
  {
    entry: "minor-cliche", title: "Chim Chim Cher-ee", artist: "Sherman Brothers",
    reason: "Sources found only describe 'chromatic downward movement in the harmony'; none states a line cliché over one chord.",
  },
];

/**
 * Verified examples that are not shown: the library keeps only the one or two best-known songs per
 * progression (owner's request). Their sources are listed in docs/library_sources.md.
 */
export const TRIMMED_EXAMPLES: { entry: string; title: string; artist: string }[] = [
  { entry: "axis", title: "No Woman, No Cry", artist: "Bob Marley and the Wailers" },
  { entry: "axis", title: "Someone Like You", artist: "Adele" },
  { entry: "fifties", title: "Heart and Soul", artist: "Hoagy Carmichael" },
  { entry: "canon", title: "Basket Case", artist: "Green Day" },
  { entry: "canon", title: "Graduation (Friends Forever)", artist: "Vitamin C" },
  { entry: "ii-v-i", title: "Satin Doll", artist: "Duke Ellington" },
  { entry: "circle", title: "Autumn Leaves", artist: "Joseph Kosma (jazz standard)" },
  { entry: "twelve-bar", title: "Pride and Joy", artist: "Stevie Ray Vaughan" },
  { entry: "rhythm-changes", title: "Oleo", artist: "Sonny Rollins" },
  { entry: "rhythm-changes", title: "Anthropology", artist: "Charlie Parker & Dizzy Gillespie" },
  { entry: "andalusian", title: "Walk, Don't Run", artist: "The Ventures" },
  { entry: "andalusian", title: "Stray Cat Strut", artist: "Stray Cats" },
  { entry: "mixolydian", title: "Sympathy for the Devil", artist: "The Rolling Stones" },
  { entry: "three-chord", title: "Wild Thing", artist: "The Troggs" },
  { entry: "dorian", title: "Evil Ways", artist: "Santana" },
  { entry: "ragtime", title: "Alice's Restaurant", artist: "Arlo Guthrie" },
  { entry: "coltrane", title: "Countdown", artist: "John Coltrane" },
];

/** Seed examples requested for the library (for the verified-vs-dropped count). */
export function exampleCounts(): { shown: number; trimmed: number; verified: number; dropped: number; seeds: number } {
  const shown = LIBRARY.reduce((s, e) => s + e.examples.length, 0);
  const trimmed = TRIMMED_EXAMPLES.length;
  const verified = shown + trimmed;
  return { shown, trimmed, verified, dropped: DROPPED_EXAMPLES.length, seeds: verified + DROPPED_EXAMPLES.length };
}
