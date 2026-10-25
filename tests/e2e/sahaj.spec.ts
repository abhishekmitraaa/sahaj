import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  axeViolations, fakeMicrophone, fakeSpeech, openHindiSample, openSample, sampleHighlightedWords, start,
} from './helpers';

const stat = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.stats li', { hasText: label }).locator('.num');

test.describe('Home and onboarding', () => {
  test('onboarding applies a profile and is remembered', async ({ page }) => {
    await start(page, 'Reading is tiring');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Study material');
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'How can Sahaj help you study?' })).toBeHidden();
    await expect(page.getByLabel('Learning profile')).toHaveValue('dyslexia');
  });

  test('interface switches between English and Hindi', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'हिंदी' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('पढ़ाई');
    await expect(page.getByRole('button', { name: 'विज्ञान का नमूना अध्याय खोलें' })).toBeVisible();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('Clean-Read pipeline', () => {
  test('sample PDF is rebuilt into clean, navigable structure', async ({ page }) => {
    await start(page);
    await openSample(page);
    const paper = page.locator('.paper');
    await expect(paper.locator('h2')).toHaveCount(6);
    await expect(page.locator('.toc a')).toHaveCount(7);
    await expect(paper.locator('li.blk-list')).toHaveCount(4);
    await expect(paper.locator('figure')).toHaveCount(1);
    await expect(paper).not.toContainText('Science for Class VII');
    await expect(paper).not.toContainText('Sahaj sample chapter');
    await expect(paper).toContainText('oxygen produced during photosynthesis leaves through them.');
    await expect(paper).not.toContainText('photo- synthesis');

    await page.getByRole('tab', { name: 'Fixes' }).click();
    await expect(stat(page, 'headers removed')).toHaveText('2');
    await expect(stat(page, 'footers removed')).toHaveText('2');
    await expect(stat(page, 'Page numbers removed')).toHaveText('2');
    await expect(stat(page, 'Words rejoined')).toHaveText('18');
    await expect(stat(page, 'column order')).toHaveText('1');
    await expect(stat(page, 'Headings found')).toHaveText('7');
  });

  test('before / after view marks what was wrong with the original', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Before / after' }).click();
    await expect(page.getByRole('heading', { name: 'Before and after' })).toBeVisible();
    const raw = page.locator('.raw');
    expect(await raw.locator('.tag-header').count()).toBeGreaterThanOrEqual(2);
    await expect(raw.locator('.tag-page')).toHaveCount(2);
    expect(await raw.locator('.tag-mixed').count()).toBeGreaterThan(5);
    expect(await raw.locator('.tag-hyphen').count()).toBeGreaterThan(5);
    await expect(raw.locator('.tag-mixed').first()).not.toContainText('Chapter 4: How Plants');
    await page.getByRole('button', { name: 'Back to reading' }).click();
    await expect(page.locator('.paper')).toBeVisible();
  });

  test('pasted text becomes a structured document', async ({ page }) => {
    await start(page);
    await page.getByLabel('Or paste text').fill('# The Water Cycle\n\nWater evaporates from the sea. It rises and cools.\n\n## Rain\n\nClouds release rain when droplets grow heavy.');
    await page.getByRole('button', { name: 'Read this text' }).click();
    await expect(page.locator('.paper h1')).toHaveText('The Water Cycle');
    await expect(page.locator('.paper h2')).toHaveText('Rain');
  });

  test('Word document keeps its headings and lists', async ({ page }) => {
    await start(page);
    await page.locator('#file-input').setInputFiles('tests/e2e/fixtures/solar-system.docx');
    await expect(page.locator('.paper h1')).toHaveText('Our Solar System');
    await expect(page.locator('.paper h2')).toHaveText(['The Inner Planets', 'The Outer Planets']);
    await expect(page.locator('.paper li.blk-list')).toHaveCount(3);
  });

  test('photo of a page is read with offline OCR', async ({ page }) => {
    test.setTimeout(180_000);
    await start(page);
    await page.locator('#file-input').setInputFiles('docs/ocr-sample-page.png');
    await expect(page.locator('.paper h1')).toHaveText('The Water Cycle', { timeout: 120_000 });
    await expect(page.locator('.paper')).toContainText('evaporation');
    await expect(page.locator('.paper')).toContainText('condensation');
    await expect(page.locator('.paper p').filter({ hasText: /^14$/ })).toHaveCount(0);
  });

  test('unsupported file explains what can be opened', async ({ page }) => {
    await start(page);
    await page.locator('#file-input').setInputFiles({ name: 'marks.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a document') });
    await expect(page.getByRole('alert')).toContainText('Sahaj can open PDF, Word (.docx), text and image files');
  });
});

test.describe('Read aloud', () => {
  test('highlights word by word and moves through sentences and blocks', async ({ page }) => {
    await fakeSpeech(page);
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    const seen = await sampleHighlightedWords(page, 2500);
    expect(seen.slice(0, 3)).toEqual(['Chapter', '4', 'How']);
    expect(seen).toContain('Every');
    await expect(page.locator('.sent.is-reading')).toHaveCount(1);
    const log = await page.evaluate(() => window.__ttsLog);
    expect(log[0].text).toBe('Chapter 4: How Plants Make Their Food');
    expect(log[0].voice).toBe('fake-en');

    // Speed change restarts the sentence at the new rate.
    await page.getByLabel('Speed').fill('1.6');
    await expect.poll(() => page.evaluate(() => window.__ttsLog.at(-1)?.rate)).toBe(1.6);

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  });

  test('falls back to estimated timing when the voice gives no word events', async ({ page }) => {
    await fakeSpeech(page, { boundary: false });
    await start(page);
    await openSample(page);
    await page.locator('#blk-b1 .tool-btn').first().click({ force: true });
    const seen = await sampleHighlightedWords(page, 2500);
    expect(seen.length).toBeGreaterThanOrEqual(5);
    expect(seen[0]).toBe('Every');
  });

  test('clicking a word starts reading from its sentence', async ({ page }) => {
    await fakeSpeech(page);
    await start(page);
    await openSample(page);
    await page.locator('.paper .w', { hasText: 'stomata' }).first().click();
    await expect.poll(() => page.evaluate(() => window.__ttsLog.at(-1)?.text)).toBe('These pores are called stomata.');
  });

  test('sentence and section navigation', async ({ page }) => {
    await fakeSpeech(page);
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Next section' }).click();
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.1 What is Photosynthesis?');
    await page.getByRole('button', { name: 'Next sentence' }).click();
    await expect(page.locator('.sent.is-reading')).toContainText('Photosynthesis is the process');
    await page.getByRole('button', { name: 'Next sentence' }).click();
    await expect(page.locator('.sent.is-reading')).toContainText('The word comes from two Greek words');
    await page.getByRole('button', { name: 'Previous section' }).click();
    await expect(page.locator('.sent.is-reading')).toHaveText('4.1 What is Photosynthesis?');
  });

  test('Hindi text is read with a Hindi voice', async ({ page }) => {
    await fakeSpeech(page);
    await start(page);
    await openHindiSample(page);
    await expect(page.locator('.paper')).toHaveClass(/lang-hi/);
    await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__ttsLog[0]?.voice)).toBe('fake-hi');
    const seen = await sampleHighlightedWords(page, 1200);
    expect(seen[0]).toBe('प्रकाश');
  });

  test('real installed voice speaks and highlights (smoke test)', async ({ page }) => {
    await start(page);
    await openSample(page);
    const voices = await page.evaluate(async () => {
      for (let i = 0; i < 20 && !speechSynthesis.getVoices().length; i++) await new Promise((r) => setTimeout(r, 100));
      return speechSynthesis.getVoices().length;
    });
    test.skip(voices === 0, 'No speech voices available to this browser');
    await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
    const seen = await sampleHighlightedWords(page, 5000);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    await page.getByRole('button', { name: 'Pause' }).click();
  });
});

test.describe('Reading aids and display', () => {
  test('plain language rewrites text and lowers the reading level', async ({ page }) => {
    await start(page, 'Reading is tiring');
    await openSample(page);
    const para = page.locator('.paper p', { hasText: 'green pigment' });
    await expect(para.locator('.sr-only')).toContainText('grade 9');
    await page.locator('.reading-scroll').focus();
    await page.keyboard.press('s');
    expect(await page.locator('.w.was-plain').count()).toBeGreaterThan(15);
    await expect(page.locator('.w.was-plain', { hasText: 'use' }).first()).toHaveAttribute('title', /Original: utilize/);
    await expect(para.locator('.sr-only')).toContainText('grade 7');
    await expect(para).toContainText('This energy is later used');
  });

  test('display drawer controls theme, font, size and aids', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Display' }).click();
    const drawer = page.getByRole('dialog', { name: 'Display' });
    await drawer.getByRole('radio', { name: 'Night' }).check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await drawer.getByRole('radio', { name: 'OpenDyslexic' }).check({ force: true });
    await expect(page.locator('.paper')).toHaveAttribute('style', /OpenDyslexic/);
    await drawer.getByLabel(/Text size/).fill('30');
    await expect(page.locator('.paper')).toHaveAttribute('style', /--fs: 30px/);
    await drawer.getByRole('radio', { name: 'blue' }).check({ force: true });
    await expect(page.locator('.overlay-blue')).toHaveCount(1);
    await drawer.getByRole('switch', { name: /Bold word starts/ }).check();
    expect(await page.locator('.paper .w b').count()).toBeGreaterThan(100);
    await drawer.getByRole('switch', { name: /Split syllables/ }).check();
    expect(await page.locator('.paper .syl').count()).toBeGreaterThan(100);
    await expect(page.locator('.paper .w b')).toHaveCount(0);
    await drawer.getByRole('switch', { name: /Difficulty marks/ }).check();
    expect(await page.locator('.diff').count()).toBeGreaterThan(5);
    await drawer.getByRole('switch', { name: /Reading ruler/ }).check();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await page.mouse.move(700, 400);
    await expect(page.locator('.ruler')).toBeVisible();
  });

  test('profiles change many settings at once', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByLabel('Learning profile').selectOption('lowvision');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await expect(page.locator('.paper')).toHaveAttribute('style', /--fs: 34px/);
    await expect(page.locator('.toc')).toBeHidden();
    await page.getByLabel('Learning profile').selectOption('focus');
    await expect(page.locator('.app')).toHaveClass(/is-focus/);
    expect(await page.locator('.paper .w b').count()).toBeGreaterThan(100);
  });

  test('keyboard shortcuts work and the help dialog traps focus', async ({ page }) => {
    await fakeSpeech(page);
    await start(page);
    await openSample(page);
    await page.locator('.reading-scroll').focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.keyboard.press('k');
    await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
    await page.keyboard.press('n');
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.1 What is Photosynthesis?');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.sent.is-reading')).toContainText('Photosynthesis is the process');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.player-speed output')).toHaveText('1.1×');
    await page.keyboard.press('+');
    await expect(page.locator('.paper')).toHaveAttribute('style', /--fs: 22px/);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: /Keyboard shortcuts/ });
    await expect(help).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await help.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });

  test('glossary mines definitions and links to the text', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByRole('tab', { name: 'Key words' }).click();
    const item = page.locator('.gloss li', { hasText: 'stomata' }).first();
    await expect(item.locator('.gloss-def')).toHaveText('These pores are called stomata.');
    await expect(item.locator('.gloss-hi')).toHaveText('रंध्र');
    for (const term of ['photosynthesis', 'chlorophyll', 'transpiration', 'xylem', 'chloroplasts', 'glucose']) {
      await expect(page.locator('.gloss-term', { hasText: term }).first()).toBeVisible();
    }
    await page.getByLabel('Search key words').fill('xylem');
    await expect(page.locator('.gloss li')).toHaveCount(1);
  });

  test('summary lists key points per section', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByRole('tab', { name: 'Summary' }).click();
    await expect(page.locator('.panel-body h3')).toHaveCount(7);
    expect(await page.locator('.points li').count()).toBeGreaterThan(8);
  });
});

test.describe('Lecture Sync', () => {
  test('demo lecture follows the document and files notes by section', async ({ page }) => {
    test.setTimeout(180_000);
    await start(page, 'Deaf or hard of hearing');
    await openSample(page);
    await page.getByRole('button', { name: 'Lecture' }).click();
    await page.getByRole('button', { name: 'Play demo lecture' }).click();
    const strip = page.getByRole('region', { name: 'Lecture captions' });
    await expect(strip).toBeVisible();
    const here = page.locator('.blk.is-here');
    await expect(here).toContainText('Photosynthesis is the process', { timeout: 40_000 });
    await expect(here).toHaveAttribute('aria-current', 'location');
    await expect(here).toContainText('underside of a leaf', { timeout: 60_000 });
    await expect(strip).toContainText('Teacher is here: 4.2 The Leaf: A Food Factory');

    await page.getByRole('tab', { name: /Notes/ }).click();
    await expect(page.locator('.notes-group h3', { hasText: '4.1 What is Photosynthesis?' })).toBeVisible();
    expect(await page.locator('.note').count()).toBeGreaterThan(5);

    // A key term in the captions opens its definition.
    await expect(strip.locator('.cap-term').first()).toBeVisible({ timeout: 30_000 });
    await strip.locator('.cap-term').first().click();
    await expect(page.locator('.gloss li.is-focus')).toHaveCount(1);

    await page.getByRole('tab', { name: /Notes/ }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save notes' }).click();
    const md = readFileSync(await (await download).path(), 'utf8');
    expect(md).toContain('# Class notes: Chapter 4: How Plants Make Their Food');
    expect(md).toContain('## 4.1 What is Photosynthesis?');

    await strip.getByRole('button', { name: 'Stop' }).click();
    await expect(strip).toBeHidden();
  });

  test('live captions from the microphone jump to the matching paragraph', async ({ page }) => {
    await fakeMicrophone(page);
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Lecture' }).click();
    await page.getByRole('button', { name: 'Start live captions' }).click();
    const strip = page.getByRole('region', { name: 'Lecture captions' });
    await expect(strip).toContainText('Waiting for the teacher to speak');
    const say = (t: string) => page.evaluate((text) => window.__say(text), t);
    await expect.poll(() => say('good morning everyone, please open your notebooks')).toBe('en-IN');
    await expect(page.locator('.blk.is-here')).toHaveCount(0);
    await say('today we learn how green plants prepare their own food');
    await expect(page.locator('.blk.is-here')).toContainText('Every living organism requires food');
    await say('photosynthesis means putting together, plants make glucose and give out oxygen');
    await expect(page.locator('.blk.is-here')).toContainText('Photosynthesis is the process');
    await say('look at the tiny pores under the leaf, the stomata let carbon dioxide in');
    await expect(page.locator('.blk.is-here')).toContainText('underside of a leaf');
    await say('some water escapes from the leaves as vapour and we call it transpiration');
    await expect(page.locator('.blk.is-here')).toContainText('Plants lose a large amount of water');
    await expect(strip).toContainText('Teacher is here: 4.4 Water and Transpiration');
    await say('okay everyone settle down please');
    await expect(page.locator('.blk.is-here')).toContainText('Plants lose a large amount of water');
    await strip.getByRole('button', { name: 'Stop' }).click();
  });

  test('blocked microphone shows a clear message', async ({ page }) => {
    await fakeMicrophone(page);
    await start(page);
    await openSample(page);
    await page.evaluate(() => (window.__failNextRecognition = 'not-allowed'));
    await page.getByRole('button', { name: 'Lecture' }).click();
    await page.getByRole('button', { name: 'Start live captions' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Microphone access is blocked' })).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Lecture captions' })).toBeHidden();
  });
});

test.describe('Voice commands', () => {
  test('English and Hindi spoken commands control the app', async ({ page }) => {
    await fakeMicrophone(page);
    await fakeSpeech(page);
    await start(page);
    await openSample(page);
    const command = async (text: string) => {
      await page.getByRole('button', { name: /Voice commands|Listening/ }).click();
      await expect.poll(() => page.evaluate((t) => window.__say(t), text)).not.toBe(false);
    };
    await command('dark mode');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await command('next section');
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.1 What is Photosynthesis?');
    await command('bigger text');
    await expect(page.locator('.paper')).toHaveAttribute('style', /--fs: 24px/);
    await command('what does chlorophyll mean');
    await expect(page.locator('.gloss li.is-focus .gloss-term')).toContainText('chlorophyll');
    await command('go to transpiration');
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.4 Water and Transpiration');
    await command('read');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await command('stop');
    await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
    await command('banana');
    await expect(page.getByRole('status').filter({ hasText: 'not a command' })).toHaveCount(1);

    // Hindi interface listens in Hindi.
    await page.getByRole('button', { name: 'हिंदी' }).click();
    await page.getByRole('button', { name: /आवाज़ से आदेश|सुन रहा है/ }).click();
    await expect.poll(() => page.evaluate(() => window.__say('धीरे'))).toBe('hi-IN');
    await expect(page.locator('.player-speed output')).toHaveText('0.8×');
  });
});

test.describe('Library, offline, mobile', () => {
  test('library remembers documents and reading position', async ({ page }) => {
    await start(page);
    await openSample(page);
    await page.getByRole('button', { name: 'Next section' }).click();
    await page.getByRole('button', { name: 'Next section' }).click();
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.2 The Leaf: A Food Factory');
    await page.waitForTimeout(1000);
    await page.reload();
    const entry = page.locator('.library li', { hasText: 'Chapter 4: How Plants Make Their Food' });
    await expect(entry).toBeVisible();
    await entry.locator('.library-open').click();
    await expect(page.locator('.toc a[aria-current="true"]')).toHaveText('4.2 The Leaf: A Food Factory');
    await page.locator('.brand').click();
    await entry.getByRole('button', { name: /Remove/ }).click();
    await expect(entry).toHaveCount(0);
  });

  test.describe('offline', () => {
    test.use({ serviceWorkers: 'allow' });
    test('works with no internet after the first visit', async ({ page, context }) => {
      test.setTimeout(180_000);
      await start(page);
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true);
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Study material');
      await openSample(page);
      await page.locator('.brand').click();
      await openHindiSample(page);
      await context.setOffline(false);
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('fits a phone screen with no sideways scrolling', async ({ page }) => {
      await start(page, 'Reading is tiring');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await openSample(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      expect((await page.locator('.topbar').boundingBox())!.height).toBeLessThan(70);
      await expect(page.locator('.panel-body')).toHaveCount(0);
      await expect(page.locator('.play-btn')).toBeVisible();
      await page.getByRole('button', { name: 'Key words' }).click();
      await expect(page.locator('.panel-body')).toBeVisible();
      await page.getByRole('button', { name: 'Close panel' }).click();
      await expect(page.locator('.panel-body')).toHaveCount(0);
    });
  });
});

test.describe('Accessibility', () => {
  test('axe-core finds no violations on any screen or theme', async ({ page }) => {
    await page.goto('/');
    expect(await axeViolations(page), 'onboarding').toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();
    expect(await axeViolations(page), 'home').toEqual([]);
    await openSample(page);
    for (const theme of ['paper', 'sepia', 'night', 'contrast']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      expect(await axeViolations(page), `reader (${theme})`).toEqual([]);
    }
    for (const tab of ['Key words', 'Summary', 'Notes']) {
      await page.getByRole('tab', { name: new RegExp(tab) }).click();
      expect(await axeViolations(page), `panel ${tab}`).toEqual([]);
    }
    await page.getByRole('button', { name: 'Display' }).click();
    expect(await axeViolations(page), 'display drawer').toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Before / after' }).click();
    expect(await axeViolations(page), 'before/after').toEqual([]);
  });
});
