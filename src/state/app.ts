import { create } from 'zustand';
import type { Doc } from '../lib/types';
import type { Caption, Position } from '../lib/storage';

export type LectureMode = 'live' | 'sim';

interface AppState {
  doc: Doc | null;
  compare: boolean;
  pos: Position;
  playing: boolean;
  /** Message for the screen-reader live region (and the visual status toast). */
  status: { text: string; id: number };
  lecture: {
    active: boolean;
    mode: LectureMode | null;
    interim: string;
    captions: Caption[];
    match: number | null;
    local: boolean | null;
    startedAt: number;
  };
  translations: Record<string, string>;
  glossaryFocus: string | null;
  displayOpen: boolean;
  helpOpen: boolean;
  set: (patch: Partial<AppState>) => void;
  announce: (text: string) => void;
  setLecture: (patch: Partial<AppState['lecture']>) => void;
}

export const useApp = create<AppState>()((set) => ({
  doc: null,
  compare: false,
  pos: { b: 0, s: 0 },
  playing: false,
  status: { text: '', id: 0 },
  lecture: { active: false, mode: null, interim: '', captions: [], match: null, local: null, startedAt: 0 },
  translations: {},
  glossaryFocus: null,
  displayOpen: false,
  helpOpen: false,
  set: (patch) => set(patch),
  announce: (text) => set((s) => ({ status: { text, id: s.status.id + 1 } })),
  setLecture: (patch) => set((s) => ({ lecture: { ...s.lecture, ...patch } })),
}));
