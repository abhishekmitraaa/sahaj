export type Command =
  | { type: 'play' | 'pause' | 'faster' | 'slower' | 'next' | 'previous' | 'nextSection' | 'prevSection' }
  | { type: 'bigger' | 'smaller' | 'ruler' | 'simplify' | 'translate' | 'summary' | 'glossary' | 'notes' }
  | { type: 'lectureStart' | 'lectureStop' | 'whereAmI' | 'help' | 'top' }
  | { type: 'theme'; theme: 'dark' | 'light' | 'contrast' | 'sepia' }
  | { type: 'goto'; query: string }
  | { type: 'define'; term: string };

const has = (s: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) => (typeof n === 'string' ? s.includes(n) : n.test(s)));

/**
 * Turn a spoken phrase (English or Hindi) into an app command.
 * Order matters: more specific phrases are checked before general ones.
 */
export function parseCommand(input: string): Command | null {
  const s = input.toLowerCase().replace(/[.,!?।]/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // Definitions: "what does photosynthesis mean", "define stomata", "क्लोरोफिल का मतलब"
  let m =
    s.match(/^(?:what does|what do) (.+?) mean$/) ??
    s.match(/^(?:what is|what are|what's) (?:the meaning of )?(?:a |an |the )?(.+)$/) ??
    s.match(/^(?:define|meaning of|explain) (?:the word )?(.+)$/) ??
    s.match(/^(.+?) (?:का|के) (?:मतलब|अर्थ)(?: क्या है| बताओ)?$/) ??
    s.match(/^(.+?) क्या (?:है|होता है|होती है)$/);
  if (m && !/^(this|that|it|यह|वह)$/.test(m[1])) return { type: 'define', term: m[1].trim() };

  m = s.match(/^(?:go to|jump to|open|take me to|read about) (?:the )?(?:section (?:on |about )?)?(.+)$/);
  if (m && !/^(next|previous|the next|top|start|beginning)/.test(m[1])) return { type: 'goto', query: m[1] };

  if (has(s, 'start lecture', 'start captions', 'lecture mode', 'turn on captions', 'लेक्चर शुरू', 'कैप्शन चालू')) return { type: 'lectureStart' };
  if (has(s, 'stop lecture', 'stop captions', 'end lecture', 'turn off captions', 'लेक्चर बंद', 'कैप्शन बंद')) return { type: 'lectureStop' };

  if (has(s, /next (section|chapter|heading|topic|part)/, 'अगला भाग', 'अगला अध्याय', 'अगला विषय')) return { type: 'nextSection' };
  if (has(s, /(previous|last) (section|chapter|heading|topic|part)/, 'पिछला भाग', 'पिछला अध्याय', 'पिछला विषय')) return { type: 'prevSection' };
  if (has(s, 'go to top', 'beginning', 'start over', 'from the start', 'शुरू से')) return { type: 'top' };

  if (has(s, 'faster', 'speed up', 'तेज़', 'तेज', 'जल्दी')) return { type: 'faster' };
  if (has(s, 'slower', 'slow down', 'धीरे')) return { type: 'slower' };
  if (has(s, /\b(bigger|larger|zoom in|increase text|increase font)\b/, 'बड़ा')) return { type: 'bigger' };
  if (has(s, /\b(smaller|zoom out|decrease text|decrease font)\b/, 'छोटा')) return { type: 'smaller' };

  if (has(s, 'high contrast', 'contrast', 'कंट्रास्ट')) return { type: 'theme', theme: 'contrast' };
  if (has(s, 'dark mode', 'night mode', 'dark theme', 'डार्क', 'अंधेरा')) return { type: 'theme', theme: 'dark' };
  if (has(s, 'light mode', 'day mode', 'light theme', 'लाइट')) return { type: 'theme', theme: 'light' };
  if (has(s, 'sepia', 'warm')) return { type: 'theme', theme: 'sepia' };

  if (has(s, 'ruler', 'line focus', 'focus line', 'रूलर')) return { type: 'ruler' };
  if (has(s, 'simplify', 'simple words', 'plain language', 'easier', 'आसान', 'सरल')) return { type: 'simplify' };
  if (has(s, 'translate', 'in hindi', 'hindi mein', 'अनुवाद', 'हिंदी में')) return { type: 'translate' };
  if (has(s, 'summary', 'summarise', 'summarize', 'key points', 'सारांश', 'मुख्य बातें')) return { type: 'summary' };
  if (has(s, 'glossary', 'key words', 'keywords', 'शब्दावली')) return { type: 'glossary' };
  if (has(s, 'notes', 'transcript', 'नोट्स')) return { type: 'notes' };
  if (has(s, 'where am i', 'which section', 'कहाँ हूँ', 'कहां हूं')) return { type: 'whereAmI' };
  if (has(s, 'help', 'what can i say', 'commands', 'मदद')) return { type: 'help' };

  if (has(s, /\bnext\b/, 'skip', 'अगला', 'आगे')) return { type: 'next' };
  if (has(s, /\b(previous|back|repeat|again)\b/, 'पिछला', 'पीछे', 'दोबारा', 'फिर से')) return { type: 'previous' };

  if (has(s, /\b(stop|pause|wait|quiet|silence)\b/, 'रुको', 'रोको', 'बंद करो', 'ठहरो')) return { type: 'pause' };
  if (has(s, /\b(read|play|start|continue|resume|go on)\b/, 'पढ़ो', 'पढ़िए', 'पढो', 'सुनाओ', 'शुरू करो', 'चलाओ')) return { type: 'play' };
  return null;
}

export const COMMAND_EXAMPLES: { en: string; hi: string }[] = [
  { en: 'Read / Stop', hi: 'पढ़ो / रुको' },
  { en: 'Faster / Slower', hi: 'तेज़ / धीरे' },
  { en: 'Next / Repeat', hi: 'अगला / दोबारा' },
  { en: 'Next section', hi: 'अगला भाग' },
  { en: 'Go to stomata', hi: '—' },
  { en: 'What does chlorophyll mean', hi: 'क्लोरोफिल का मतलब' },
  { en: 'Bigger text / Dark mode', hi: 'बड़ा / डार्क' },
  { en: 'Simplify / Translate', hi: 'आसान / अनुवाद' },
  { en: 'Start lecture', hi: 'लेक्चर शुरू' },
  { en: 'Where am I', hi: 'कहाँ हूँ' },
];
