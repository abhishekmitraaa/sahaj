import { describe, expect, it } from 'vitest';
import { buildFromPages, buildFromText, joinLines } from '../src/lib/structure/build';
import { findGutter } from '../src/lib/structure/pdfLayout';
import { splitSentences, detectLang } from '../src/lib/structure/segment';
import { twoColumnPage } from './fixtures';

const sentences = (t: string) => splitSentences(t).map((s) => t.slice(s.start, s.end));

describe('splitSentences', () => {
  it('handles abbreviations, decimals and initials', () => {
    expect(sentences('Dr. Rao measured 3.5 cm. See Fig. 2 for details. It worked!')).toEqual([
      'Dr. Rao measured 3.5 cm.', 'See Fig. 2 for details.', 'It worked!',
    ]);
    expect(sentences('Plants need light, e.g. sunlight. A. P. J. Abdul Kalam agreed.')).toEqual([
      'Plants need light, e.g. sunlight.', 'A. P. J. Abdul Kalam agreed.',
    ]);
  });
  it('splits Hindi on danda', () => {
    expect(sentences('पौधे भोजन बनाते हैं। उन्हें धूप चाहिए।')).toEqual(['पौधे भोजन बनाते हैं।', 'उन्हें धूप चाहिए।']);
    expect(detectLang('पौधे भोजन बनाते हैं।')).toBe('hi');
  });
});

describe('joinLines', () => {
  it('repairs end-of-line hyphenation', () => {
    expect(joinLines('the process of photo-', 'synthesis')).toBe('the process of photosynthesis');
    expect(joinLines('a well-', 'Known')).toBe('a well- Known');
  });
});

describe('buildFromPages (two-column PDF)', () => {
  const p1 = twoColumnPage(
    1,
    ['Green plants make their own food. The', 'process is called photo-', 'synthesis and needs light.'],
    ['Leaves have tiny pores called stomata.', 'They let gases in and out of the', 'leaf.'],
    'Photosynthesis',
  );
  const p2 = twoColumnPage(2, ['Water reaches the leaves through', 'the roots and stem.'], ['Plants store extra food as starch', 'in their roots and seeds.']);

  it('detects the column gutter', () => {
    expect(findGutter(p1)).not.toBeNull();
  });

  it('reads columns in order and removes running heads, feet and page numbers', () => {
    const r = buildFromPages([p1, p2]);
    const texts = r.blocks.map((b) => b.text);
    expect(r.blocks[0]).toMatchObject({ type: 'heading', text: 'Photosynthesis' });
    expect(texts[1]).toBe('Green plants make their own food. The process is called photosynthesis and needs light.');
    expect(texts[2]).toBe('Leaves have tiny pores called stomata. They let gases in and out of the leaf.');
    expect(texts.join(' ')).not.toMatch(/Science Class|Sahaj sample/);
    expect(r.report.headersRemoved).toBe(2);
    expect(r.report.footersRemoved).toBe(2);
    expect(r.report.pageNumbersRemoved).toBe(2);
    expect(r.report.hyphenFixes).toBe(1);
    expect(r.report.columnPages).toBe(2);
    expect(r.title).toBe('Photosynthesis');
  });

  it('keeps a naive view that shows interleaved columns and junk', () => {
    const r = buildFromPages([p1, p2]);
    expect(r.raw.some((l) => l.tag === 'mixed')).toBe(true);
    expect(r.raw.filter((l) => l.tag === 'page')).toHaveLength(2);
  });
});

describe('buildFromText', () => {
  it('finds headings, lists, figures and removes page numbers', () => {
    const r = buildFromText(
      [
        '# Plant Nutrition', '', 'Plants make food in their leaves. This', 'process needs sunlight and wa-', 'ter.', '',
        '12', '', '1.2 Parts of a Leaf', '', '- Stomata: tiny pores', '- Veins carry water', '',
        'Figure 2: Cross-section of a leaf',
      ].join('\n'),
    );
    expect(r.blocks.map((b) => b.type)).toEqual(['heading', 'para', 'heading', 'list', 'list', 'figure']);
    expect(r.blocks[1].text).toBe('Plants make food in their leaves. This process needs sunlight and water.');
    expect(r.report.pageNumbersRemoved).toBe(1);
    expect(r.blocks[0].level).toBe(1);
  });
});
