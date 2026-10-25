# Sahaj: 3-minute demo script

**Setup before you present (2 minutes)**
1. Run `npm run build && npm run preview` and open http://localhost:4173 in **Chrome**. Open it once while online so it is cached for offline use.
2. Zoom the browser to 110–125% so the back row can read it.
3. Have a second tab with a teacher-style PDF of your own, if you want to show a "real" file.
4. Volume up for read-aloud. You do not need a microphone: the demo lecture covers captions.
5. **Download the Hindi translator once while online.** Open the sample chapter and click **अ Listen in Hindi** in the player. Wait until the Hindi appears under the title (under a minute the first time). After that it works offline.
6. Make sure a Hindi voice is available. "Google हिन्दी" works while online; for offline use, add Hindi under Windows Settings → Time & language → Speech.

---

## 0:00 – The hook (20 s)

> "Take one chapter PDF and three students. Riya has dyslexia. Arjun is hard of hearing. Meera has low vision and studies in Hindi. Today each of them needs a different app, and none of those apps fixes the PDF itself. Sahaj takes **one document and adapts it to every sense**, offline, with nothing uploaded."

Show the home page. Point at the onboarding profiles if they appear.

## 0:20 – Messy PDF in, clean text out (35 s)

1. Click **Try the sample science chapter**. It's a typical two-column school PDF.
2. Open **Before / after** in the top bar.
   > "On the left is what a normal screen reader or text-to-speech app reads. The two columns are mixed into one line ('…water and carbon **4.3 The Role of Chlorophyll**'), and it reads the running header, the page numbers and broken words like 'photo- synthesis'. On the right is what Sahaj rebuilt: correct column order, 7 headings to navigate by, and 18 broken words rejoined."
3. Click **Back to reading** and point at the **Fixes** tab counts.

## 0:55 – Riya: reading is tiring (40 s)

1. Profile menu → **Reading is tiring**: Lexend font, wide spacing, sepia, reading ruler, difficulty marks.
2. Press **Space**: read-aloud starts, and the yellow highlighter follows every word.
   > "Every word is highlighted as it's spoken, so her eyes and ears stay together."
3. Point at the margin marks (Easy / Medium / Hard). Press **S** for **Plain language**.
   > "Long sentences are split and hard words are swapped. 'Utilize' becomes 'use', and the green underline shows the original. This paragraph goes from a grade-9 to a grade-7 reading level, offline."
4. Press **Space** to pause.

## 1:35 – Arjun: deaf in a lecture (50 s), the headline feature

1. Profile → **Deaf or hard of hearing**. The Notes tab opens.
2. Dock → **Lecture** → **Play demo lecture** (or **Start live captions** and speak about plants).
   > "Live captions exist already. What doesn't exist is captions that know the textbook. As the teacher talks, Sahaj finds the paragraph being discussed and moves the page there. See 'Teacher is here' in the margin. The teacher never reads the book word for word, so this is meaning matching, not text search."
3. Click an underlined word in the captions, such as **stomata**. The Key words panel opens on its definition, taken from the chapter itself.
4. Open the **Notes** tab:
   > "The whole lecture is saved as notes, filed under the section it belonged to. One click exports them as a study sheet."

## 2:25 – Meera: low vision, Hindi medium (25 s)

1. Profile → **Low vision**: very large high-contrast text, with spoken confirmations.
2. Stay on the English chapter and click **अ Listen in Hindi** in the player (or press **H**).
   > "Meera studies in Hindi, but her chapter is in English. Sahaj translates it on this laptop, a paragraph ahead of the voice, and reads it to her in Hindi. The Hindi appears under the English so she can follow both, and the highlighter tracks the Hindi words. Nothing is sent to the internet."
3. Press **V** and say **"धीरे"** (slower) or **"अंग्रेज़ी में पढ़ो"** (back to English). Or click the mic and say "bigger text".
   > "Hands-free and bilingual. Every action is confirmed out loud and to screen readers."

## 2:50 – Close (10 s)

> "Clean reading order, word-by-word read-aloud, lecture captions that follow the chapter, and adjustable display, in English and Hindi. No account, no upload, no internet needed. Sahaj: one document, every sense."

---

## Likely judge questions

- **"How does it translate without an AI API?"** Chrome 138+ ships an on-device translation model. Sahaj uses it through the browser's Translator API, so the text never leaves the laptop. Browsers without it show a clear message, and everything else still works.
- **"Is this using an AI API?"** No. The PDF repair, lecture matching (TF-IDF with forward-biased tracking), glossary mining, TextRank summaries and plain-language rewriting all run locally in the browser. If Chrome's built-in on-device AI is present, Sahaj can also translate paragraphs and shorten summaries, still without sending anything to a server.
- **"Does it work offline?"** Yes, after the first load (it's an installable PWA). The one exception is Chrome's live speech recognition, which uses Google's online service unless the device supports on-device recognition. The demo lecture mode is fully offline.
- **"What about scanned PDFs or photos of the board?"** Pages with no text layer go through Tesseract OCR (English + Hindi), bundled locally.
- **"Is the app itself accessible?"** It meets WCAG 2.2 AA: keyboard shortcuts (`?`), focus management, live regions and 44px targets. axe-core reports zero violations in all four themes.
- **"How do you know it helps?"** The Fixes panel quantifies the repairs. Plain-language mode shows the reading grade dropping. The Before / After view shows the reading-order problem the student would otherwise hear.

## If something goes wrong

- **No sound:** check the voice menu in the dock and pick another voice. On Windows, Microsoft voices work offline.
- **Live captions show a microphone or network error:** use **Play demo lecture** instead.
- **The page looks stale after rebuilding:** updates apply on the next launch, so close the tab and reopen it.
