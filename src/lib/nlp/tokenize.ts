import { words } from '../structure/segment';

export const STOPWORDS = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before being below between both but by ' +
    'can could did do does doing down during each few for from further had has have having he her here hers herself him himself ' +
    'his how i if in into is it its itself just let like make makes made many may me more most much must my myself no nor not now ' +
    'of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them ' +
    'themselves then there these they this those through to too under until up upon us very was we were what when where which ' +
    'while who whom why will with would you your yours yourself yourselves one two three get got called known use used using ' +
    'also thus therefore however every well way ways even still yet within without another often usually called see shown ' +
    'okay ok so right now today let lets going gonna yeah um uh actually basically talk talking look looking class students ' +
    'और का के की है हैं को में से पर यह वह भी तो ही एक इस उस लिए था थे थी होता होती होते जो कि कर करते करता करती गया ' +
    'गए गई ने नहीं या हम आप तुम वे ये अपने अपनी अपना'
  ).split(/\s+/),
);

/** Light English stemmer: enough to match "plants"/"plant", "absorbed"/"absorb". */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (/[ऀ-ॿ]/.test(w) || w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  for (const suf of ['ational', 'ization', 'fulness', 'ousness', 'iveness', 'ments', 'ment', 'ingly', 'edly', 'ing', 'ed', 'ly', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      if (suf === 's' && (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is'))) continue;
      if (suf === 'es' && !/(?:sh|ch|x|z|ss)es$/.test(w)) continue;
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w;
}

/** Content-bearing terms (lowercased, stemmed, no stopwords or numbers). */
export function terms(text: string): string[] {
  const out: string[] = [];
  for (const { word } of words(text)) {
    const lw = word.toLowerCase();
    if (lw.length < 2 || STOPWORDS.has(lw) || /^\d+$/.test(lw)) continue;
    out.push(stem(lw));
  }
  return out;
}
