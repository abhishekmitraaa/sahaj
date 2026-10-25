import type { ViewBlock } from '../lib/view';
import { sectionOf } from '../lib/view';
import { useApp } from '../state/app';
import { useT } from '../i18n';

export function Toc({ blocks, onGo }: { blocks: ViewBlock[]; onGo: (index: number) => void }) {
  const t = useT();
  const pos = useApp((s) => s.pos);
  const current = sectionOf(blocks, pos.b);
  const headings = blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'heading');
  return (
    <nav className="toc" aria-label={t('contents')}>
      <h2>{t('contents')}</h2>
      <ol>
        {headings.map(({ b, i }) => (
          <li key={b.id} className={`lvl-${b.level ?? 2}`}>
            <a
              href={`#blk-${b.id}`}
              aria-current={i === current ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onGo(i);
                document.getElementById(`blk-${b.id}`)?.focus({ preventScroll: true });
              }}
              lang={b.lang}
            >
              {b.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
