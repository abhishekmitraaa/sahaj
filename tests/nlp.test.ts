import { describe, expect, it } from 'vitest';
import { countSyllables, splitSyllables } from '../src/lib/nlp/syllables';
import { readability } from '../src/lib/nlp/readability';
import { buildFromText } from '../src/lib/structure/build';
import { LectureMatcher } from '../src/lib/nlp/match';
import { buildGlossary, mineDefinitions } from '../src/lib/nlp/glossary';
import { simplify } from '../src/lib/nlp/simplify';
import { summarize } from '../src/lib/nlp/summarize';
import { parseCommand } from '../src/lib/speech/commands';

describe('syllables', () => {
  it('counts common words', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('table')).toBe(2);
    expect(countSyllables('photosynthesis')).toBe(5);
    expect(countSyllables('make')).toBe(1);
  });
  it('splits into chunks', () => {
    expect(splitSyllables('photosynthesis').join('·')).toBe('pho·to·syn·the·sis');
    expect(splitSyllables('chlorophyll').length).toBeGreaterThan(1);
    expect(splitSyllables('cat')).toEqual(['cat']);
  });
});

describe('readability', () => {
  it('rates simple text easier than dense text', () => {
    const easy = readability('The cat sat on the mat. It was warm. The sun was out.');
    const hard = readability(
      'Photosynthetic organisms utilize electromagnetic radiation to synthesize carbohydrates from atmospheric carbon dioxide, subsequently releasing molecular oxygen as a metabolic byproduct.',
    );
    expect(easy.difficulty).toBe('easy');
    expect(hard.difficulty).toBe('hard');
    expect(hard.grade).toBeGreaterThan(easy.grade);
  });
});

const doc = buildFromText(`# Photosynthesis

Photosynthesis is the process by which green plants make their own food using sunlight, water and carbon dioxide.

## Stomata

Leaves have tiny pores on their surface. These pores are called stomata. Stomata let carbon dioxide enter the leaf and oxygen leave it.

## Transpiration

Plants lose water as vapour through their leaves. This loss of water is called transpiration. Transpiration helps pull water up from the roots.

## Chlorophyll

Chlorophyll is a green pigment found in leaves. Chlorophyll captures energy from sunlight.`);

describe('LectureMatcher', () => {
  it('follows a paraphrased lecture through the document', () => {
    const m = new LectureMatcher(doc.blocks);
    const idx = (text: string) => m.push(text)?.blockIndex;
    const blockOf = (word: string) => doc.blocks.findIndex((b) => b.type !== 'heading' && b.text.includes(word));
    expect(idx('so today we will learn how green plants prepare food with the help of sunlight')).toBe(blockOf('process by which'));
    expect(idx('look at the small openings on the leaf they are the stomata which let in carbon dioxide')).toBe(blockOf('tiny pores'));
    expect(idx('the plant also loses water vapour, we call this transpiration')).toBe(blockOf('vapour'));
    expect(idx('and the green colour comes from the pigment chlorophyll')).toBe(blockOf('green pigment'));
  });
  it('ignores off-topic chatter', () => {
    const m = new LectureMatcher(doc.blocks);
    expect(m.push('okay everyone please settle down and open your notebooks')).toBeNull();
  });
});

describe('glossary', () => {
  it('mines definitions from the document', () => {
    const defs = mineDefinitions(doc.blocks);
    expect(defs.get('stomata')?.definition).toBe('These pores are called stomata.');
    expect(defs.get('transpiration')).toBeTruthy();
    expect(defs.get('chlorophyll')?.definition).toMatch(/green pigment/);
    expect(defs.get('photosynthesis')).toBeTruthy();
    const g = buildGlossary(doc.blocks);
    expect(g[0].defined).toBe(true);
  });
  it('mines Hindi definitions', () => {
    const hi = buildFromText('हरे पौधे अपना भोजन स्वयं बनाते हैं। इस प्रक्रिया को प्रकाश संश्लेषण कहते हैं। पत्तियों पर छोटे छिद्र होते हैं, जिन्हें रंध्र कहते हैं। पत्तियों में क्लोरोफिल नामक एक हरा वर्णक होता है।');
    const defs = mineDefinitions(hi.blocks);
    expect([...defs.keys()]).toEqual(expect.arrayContaining(['प्रकाश संश्लेषण', 'रंध्र', 'क्लोरोफिल']));
  });
});

describe('simplify', () => {
  it('swaps complex words and splits long sentences', () => {
    const r = simplify(
      'Plants utilize sunlight to manufacture food; consequently they require approximately six hours of light every single day to grow well.',
    );
    expect(r.text).toMatch(/use sunlight/);
    expect(r.text).toMatch(/make food\./);
    expect(r.text).toMatch(/So they need about six hours/);
    expect(r.changes).toBeGreaterThanOrEqual(4);
  });
});

describe('summarize', () => {
  it('returns central sentences in order', () => {
    const pts = summarize(doc.blocks, 0.3, 3);
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.length).toBeLessThanOrEqual(3);
  });
});

describe('parseCommand', () => {
  it.each([
    ['read', { type: 'play' }],
    ['पढ़ो', { type: 'play' }],
    ['stop', { type: 'pause' }],
    ['रुको', { type: 'pause' }],
    ['a little faster please', { type: 'faster' }],
    ['धीरे', { type: 'slower' }],
    ['next section', { type: 'nextSection' }],
    ['next', { type: 'next' }],
    ['go to stomata', { type: 'goto', query: 'stomata' }],
    ['what does chlorophyll mean', { type: 'define', term: 'chlorophyll' }],
    ['क्लोरोफिल का मतलब', { type: 'define', term: 'क्लोरोफिल' }],
    ['start lecture', { type: 'lectureStart' }],
    ['dark mode', { type: 'theme', theme: 'dark' }],
    ['bigger text', { type: 'bigger' }],
    ['read in hindi', { type: 'translate' }],
    ['हिंदी में पढ़ो', { type: 'translate' }],
    ['read in english', { type: 'english' }],
    ['अंग्रेज़ी में पढ़ो', { type: 'english' }],
    ['banana', null],
  ])('%s', (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });
});
