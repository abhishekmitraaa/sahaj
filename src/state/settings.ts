import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type Theme = 'paper' | 'sepia' | 'night' | 'contrast';
export type Overlay = 'none' | 'blue' | 'green' | 'yellow' | 'rose' | 'peach';
export type FontChoice = 'atkinson' | 'lexend' | 'opendyslexic' | 'serif';
export type Panel = 'glossary' | 'summary' | 'notes' | 'report';
export type ProfileId = 'standard' | 'dyslexia' | 'lowvision' | 'blind' | 'deaf' | 'focus';

export interface DisplaySettings {
  theme: Theme;
  overlay: Overlay;
  font: FontChoice;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  measure: number;
  ruler: boolean;
  bionic: boolean;
  syllables: boolean;
  heatmap: boolean;
  plain: boolean;
  focusMode: boolean;
}

export interface Settings extends DisplaySettings {
  onboarded: boolean;
  profile: ProfileId;
  uiLang: 'en' | 'hi';
  rate: number;
  voiceEn: string | null;
  voiceHi: string | null;
  autoScroll: boolean;
  captionSize: number;
  captionLang: string;
  followLecture: boolean;
  panel: Panel | null;
  showToc: boolean;
  speakFeedback: boolean;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  theme: 'paper', overlay: 'none', font: 'atkinson', fontSize: 20, lineHeight: 1.7, letterSpacing: 0,
  wordSpacing: 0, measure: 68, ruler: false, bionic: false, syllables: false, heatmap: false, plain: false,
  focusMode: false,
};

const DEFAULTS: Settings = {
  ...DEFAULT_DISPLAY,
  onboarded: false, profile: 'standard', uiLang: 'en', rate: 1, voiceEn: null, voiceHi: null, autoScroll: true,
  captionSize: 30, captionLang: 'en-IN', followLecture: true, panel: 'report', showToc: true, speakFeedback: false,
};

export interface Profile {
  id: ProfileId;
  settings: Partial<Settings>;
}

/** Each profile changes display, speech and layout together, in one click. */
export const PROFILES: Profile[] = [
  { id: 'standard', settings: { ...DEFAULT_DISPLAY, rate: 1, panel: 'report', showToc: true, speakFeedback: false } },
  {
    id: 'dyslexia',
    settings: {
      ...DEFAULT_DISPLAY, theme: 'sepia', font: 'lexend', fontSize: 22, lineHeight: 2, letterSpacing: 0.05,
      wordSpacing: 0.16, measure: 60, ruler: true, heatmap: true, rate: 0.9, panel: 'glossary', showToc: true,
      speakFeedback: false,
    },
  },
  {
    id: 'lowvision',
    settings: {
      ...DEFAULT_DISPLAY, theme: 'contrast', font: 'atkinson', fontSize: 34, lineHeight: 1.6, letterSpacing: 0.02,
      measure: 46, rate: 1, panel: null, showToc: false, speakFeedback: true,
    },
  },
  {
    id: 'blind',
    settings: { ...DEFAULT_DISPLAY, fontSize: 22, rate: 1.4, panel: 'summary', showToc: true, speakFeedback: true },
  },
  {
    id: 'deaf',
    settings: { ...DEFAULT_DISPLAY, fontSize: 20, captionSize: 34, followLecture: true, panel: 'notes', showToc: true, speakFeedback: false },
  },
  {
    id: 'focus',
    settings: {
      ...DEFAULT_DISPLAY, font: 'lexend', fontSize: 21, lineHeight: 1.9, measure: 58, ruler: true, bionic: true,
      focusMode: true, panel: 'summary', showToc: false, rate: 1.1, speakFeedback: false,
    },
  },
];

// localStorage can throw (private windows, blocked site data): never let that break the app.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* not persisted */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  applyProfile: (id: ProfileId) => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      applyProfile: (id) => {
        const p = PROFILES.find((x) => x.id === id);
        if (p) set({ ...p.settings, profile: id });
      },
    }),
    { name: 'sahaj-settings', storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);
