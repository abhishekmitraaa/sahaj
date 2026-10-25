import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PROFILES, useSettings, type FontChoice, type Overlay, type ProfileId, type Theme } from '../state/settings';
import { useApp } from '../state/app';
import { PROFILE_TEXT, useT, type StringKey } from '../i18n';
import { COMMAND_EXAMPLES } from '../lib/speech/commands';
import { Icon } from './Icon';

/** Focus the first control on open, trap Tab inside, restore focus and close on Escape. */
function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return ref;
}

const PROFILE_ICON: Record<ProfileId, string> = {
  standard: 'book', dyslexia: 'type', lowvision: 'eye', blind: 'speaker', deaf: 'captions', focus: 'focus',
};

export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const s = useSettings();
  const ref = useModal(onDone);
  return (
    <>
      <div className="backdrop" />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="onboard-title" ref={ref}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <h2 id="onboard-title">{t('onboardTitle')}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => s.set({ uiLang: s.uiLang === 'hi' ? 'en' : 'hi' })} lang={s.uiLang === 'hi' ? 'en' : 'hi'}>
            {t('language')}
          </button>
        </div>
        <p className="dialog-lead">{t('onboardLead')}</p>
        <div className="profiles">
          {PROFILES.map((p) => {
            const [title, desc] = PROFILE_TEXT[p.id][s.uiLang];
            return (
              <button key={p.id} type="button" className="profile-card" aria-pressed={s.profile === p.id} onClick={() => s.applyProfile(p.id)}>
                <span className="profile-icon"><Icon name={PROFILE_ICON[p.id]} /></span>
                <strong>{title}</strong>
                <span>{desc}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-primary" onClick={() => { s.set({ onboarded: true }); onDone(); }}>
            {t('continue')}
          </button>
        </div>
      </div>
    </>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Range(p: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field-label">
        {p.label} <output>{p.format(p.value)}</output>
      </span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} aria-valuetext={p.format(p.value)} />
    </label>
  );
}

const THEMES: { id: Theme; bg: string; fg: string }[] = [
  { id: 'paper', bg: '#f9fbfd', fg: '#1b2a4a' },
  { id: 'sepia', bg: '#f6efe0', fg: '#33281b' },
  { id: 'night', bg: '#141e33', fg: '#e4eaf5' },
  { id: 'contrast', bg: '#000000', fg: '#ffef3a' },
];
const OVERLAYS: { id: Overlay; color: string }[] = [
  { id: 'none', color: 'transparent' },
  { id: 'blue', color: 'rgba(120,170,255,.5)' },
  { id: 'green', color: 'rgba(120,220,150,.5)' },
  { id: 'yellow', color: 'rgba(255,230,90,.6)' },
  { id: 'rose', color: 'rgba(255,140,170,.5)' },
  { id: 'peach', color: 'rgba(255,180,120,.55)' },
];
const FONT_OPTS: { id: FontChoice; label: string; family: string }[] = [
  { id: 'atkinson', label: 'Atkinson Hyperlegible', family: 'Atkinson Hyperlegible' },
  { id: 'lexend', label: 'Lexend', family: 'Lexend' },
  { id: 'opendyslexic', label: 'OpenDyslexic', family: 'OpenDyslexic' },
  { id: 'serif', label: 'Georgia', family: 'Georgia, serif' },
];

export function DisplayDrawer({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useSettings();
  const ref = useModal(onClose);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="display-title" ref={ref}>
        <div className="drawer-head">
          <h2 id="display-title">{t('display')}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">
          <label className="field">
            <span className="field-label">{t('profile')}</span>
            <select className="select" value={s.profile} onChange={(e) => s.applyProfile(e.target.value as ProfileId)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{PROFILE_TEXT[p.id][s.uiLang][0]}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t('theme')}</legend>
            <div className="swatches">
              {THEMES.map((th) => (
                <label key={th.id} className="swatch">
                  <input type="radio" name="theme" checked={s.theme === th.id} onChange={() => s.set({ theme: th.id })} />
                  <span className="swatch-chip" style={{ background: th.bg, color: th.fg }} aria-hidden="true">Aa</span>
                  {t(th.id as StringKey)}
                </label>
              ))}
            </div>
          </fieldset>
          {s.theme !== 'contrast' && (
            <fieldset>
              <legend>{t('overlay')}</legend>
              <div className="chips">
                {OVERLAYS.map((o) => (
                  <label key={o.id} className="chip-radio">
                    <input type="radio" name="overlay" checked={s.overlay === o.id} onChange={() => s.set({ overlay: o.id })} />
                    <span>
                      <span className="swatch-sm" style={{ background: o.color, marginRight: 6, border: '1px solid var(--line)' }} aria-hidden="true" />
                      {o.id === 'none' ? t('none') : o.id}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend>{t('font')}</legend>
            <div className="chips">
              {FONT_OPTS.map((f) => (
                <label key={f.id} className="chip-radio">
                  <input type="radio" name="font" checked={s.font === f.id} onChange={() => s.set({ font: f.id })} />
                  <span style={{ fontFamily: f.family }}>{f.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Range label={t('textSize')} value={s.fontSize} min={14} max={56} step={1} format={(v) => `${v}px`} onChange={(v) => s.set({ fontSize: v })} />
          <Range label={t('lineSpacing')} value={s.lineHeight} min={1.3} max={2.6} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => s.set({ lineHeight: v })} />
          <Range label={t('letterSpacing')} value={s.letterSpacing} min={0} max={0.2} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => s.set({ letterSpacing: v })} />
          <Range label={t('wordSpacing')} value={s.wordSpacing} min={0} max={0.6} step={0.04} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => s.set({ wordSpacing: v })} />
          <Range label={t('lineLength')} value={s.measure} min={36} max={90} step={2} format={(v) => `${v}`} onChange={(v) => s.set({ measure: v })} />
          <fieldset>
            <legend>{t('readingAids')}</legend>
            <Toggle label={t('ruler')} hint={t('rulerHint')} checked={s.ruler} onChange={(v) => s.set({ ruler: v })} />
            <Toggle label={t('plain')} hint={t('plainHint')} checked={s.plain} onChange={(v) => s.set({ plain: v })} />
            <Toggle label={t('heatmap')} hint={t('heatmapHint')} checked={s.heatmap} onChange={(v) => s.set({ heatmap: v })} />
            <Toggle label={t('bionic')} hint={t('bionicHint')} checked={s.bionic} onChange={(v) => s.set({ bionic: v, syllables: v ? false : s.syllables })} />
            <Toggle label={t('syllables')} hint="pho·to·syn·the·sis" checked={s.syllables} onChange={(v) => s.set({ syllables: v, bionic: v ? false : s.bionic })} />
            <Toggle label={t('focusMode')} hint={t('focusHint')} checked={s.focusMode} onChange={(v) => s.set({ focusMode: v })} />
            <Toggle label={t('autoScroll')} checked={s.autoScroll} onChange={(v) => s.set({ autoScroll: v })} />
            <Toggle label={t('speakFeedback')} checked={s.speakFeedback} onChange={(v) => s.set({ speakFeedback: v })} />
          </fieldset>
          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => s.applyProfile(s.profile)}>
            {t('resetDisplay')}
          </button>
        </div>
      </div>
    </>
  );
}

const SHORTCUTS: [string, StringKey | string][] = [
  ['Space / K', 'play'],
  ['← / →', 'prevSentence'],
  ['P / N', 'prevSection'],
  ['↑ / ↓', 'speed'],
  ['R', 'ruler'],
  ['S', 'plain'],
  ['L', 'lecture'],
  ['V', 'voiceCommands'],
  ['D', 'display'],
  ['+ / −', 'textSize'],
  ['?', 'help'],
  ['Esc', 'close'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const ref = useModal(onClose);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" ref={ref}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <h2 id="help-title">{t('shortcutsTitle')}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" />
          </button>
        </div>
        <div className="kbd-grid" style={{ marginTop: 16 }}>
          {SHORTCUTS.map(([k, label]) => (
            <div key={k}>
              <span>{t(label as StringKey) ?? label}</span>
              <kbd>{k}</kbd>
            </div>
          ))}
        </div>
        <h3>{t('sayThings')}</h3>
        <div className="kbd-grid">
          {COMMAND_EXAMPLES.map((c) => (
            <div key={c.en}>
              <span>“{c.en}”</span>
              <span lang="hi" className="muted">{c.hi}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className="toast" aria-hidden="true">{children}</div>;
}

export function useStatusToast(): string | null {
  const status = useApp((s) => s.status);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!status.text) return;
    setShown(status.text);
    const tm = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(tm);
  }, [status]);
  return shown;
}
