import type { PageInput, PageItem } from '../src/lib/types';

/** Build a fake two-column PDF page with a running header, footer and page number. */
export function twoColumnPage(pageNo: number, left: string[], right: string[], title?: string): PageInput {
  const items: PageItem[] = [];
  const add = (str: string, x: number, y: number, size = 10) => items.push({ str, x, y, w: str.length * size * 0.5, size });
  add('Science Class VII  Chapter 4', 50, 25, 9);
  let y = 80;
  if (title) {
    add(title, 50, 70, 20);
    y = 110;
  }
  left.forEach((l, i) => items.push({ str: l, x: 50, y: y + i * 14, w: 220, size: 10 }));
  right.forEach((l, i) => items.push({ str: l, x: 320, y: y + i * 14, w: 220, size: 10 }));
  add('Sahaj sample reader', 50, 770, 9);
  add(String(pageNo), 295, 785, 9);
  return { width: 600, height: 800, items };
}
