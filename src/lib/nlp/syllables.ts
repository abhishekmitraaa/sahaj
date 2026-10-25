// Heuristic English syllable counting and splitting. Good enough for readability
// scores and visual syllable chunking; not a dictionary hyphenator.

const VOWELS = 'aeiouy';
const DIGRAPHS = new Set(['th', 'ch', 'sh', 'ph', 'wh', 'ck', 'gh', 'qu', 'ng', 'wr', 'kn']);
const isVowel = (c: string) => VOWELS.includes(c);

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let groups = 0;
  let prevVowel = false;
  for (const c of w) {
    const v = isVowel(c);
    if (v && !prevVowel) groups++;
    prevVowel = v;
  }
  // Silent final "e" (make, plate) but not "-le" (table) or "-ee".
  if (w.endsWith('e') && !w.endsWith('le') && !w.endsWith('ee') && groups > 1) groups--;
  // "-ed" is usually silent except after t/d (wanted, needed).
  if (w.endsWith('ed') && !/[td]ed$/.test(w) && groups > 1) groups--;
  // Common vowel pairs that split into two syllables.
  groups += (w.match(/ia|io(?!u)|eo|ua(?!r)|uo/g) ?? []).length;
  return Math.max(1, groups);
}

/**
 * Split a word into syllable-ish chunks: pho·to·syn·the·sis.
 * Rules: V-CV, VC-CV (keeping digraphs together), and silent final e.
 */
export function splitSyllables(word: string): string[] {
  if (word.length <= 4 || !/^[A-Za-z]+$/.test(word)) return [word];
  const lower = word.toLowerCase();
  const n = lower.length;
  const vowelAt = (i: number) => {
    const c = lower[i];
    if (c === 'y') return i > 0 && !isVowel(lower[i - 1]);
    return isVowel(c);
  };
  // Treat final silent "e" as a consonant for splitting purposes.
  const silentE = lower.endsWith('e') && !lower.endsWith('le') && n > 4;
  const v = (i: number) => (silentE && i === n - 1 ? false : vowelAt(i));

  const cuts: number[] = [];
  let i = 0;
  while (i < n && !v(i)) i++; // leading consonants
  while (i < n) {
    while (i < n && v(i)) i++; // vowel group
    const cStart = i;
    while (i < n && !v(i)) i++; // consonant cluster
    const cLen = i - cStart;
    if (i >= n) break; // trailing consonants stay with last syllable
    if (cLen === 0) continue;
    if (cLen === 1) cuts.push(cStart);
    else {
      const pair = lower.slice(i - 2, i);
      cuts.push(DIGRAPHS.has(pair) && cLen === 2 ? cStart : i - (DIGRAPHS.has(pair) ? 2 : 1));
    }
  }
  const parts: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    if (c - prev >= 1 && n - c >= 2) {
      parts.push(word.slice(prev, c));
      prev = c;
    }
  }
  parts.push(word.slice(prev));
  return parts;
}
