// Thin wrapper around the Web Speech API's SpeechRecognition (Chrome / Edge).

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = (new () => RecognitionLike) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
};

const Ctor: RecognitionCtor | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, RecognitionCtor>).SpeechRecognition ??
      (window as unknown as Record<string, RecognitionCtor>).webkitSpeechRecognition)
    : undefined;

export const sttSupported = !!Ctor;

export type SttError = 'not-allowed' | 'network' | 'no-speech' | 'unsupported' | 'other';

export interface ListenOptions {
  lang: string;
  continuous: boolean;
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (e: SttError) => void;
  onStateChange?: (listening: boolean) => void;
  /** Set when recognition runs on this device (no audio leaves the computer). */
  onLocal?: (local: boolean) => void;
}

/** Start listening. Continuous sessions restart themselves when Chrome ends them. */
export function listen(o: ListenOptions): () => void {
  if (!Ctor) {
    o.onError?.('unsupported');
    return () => {};
  }
  let active = true;
  let rec: RecognitionLike | null = null;
  let restarts = 0;

  const begin = async () => {
    rec = new Ctor();
    rec.lang = o.lang;
    rec.continuous = o.continuous;
    rec.interimResults = true;
    try {
      if (Ctor.available && (await Ctor.available({ langs: [o.lang], processLocally: true })) === 'available') {
        rec.processLocally = true;
        o.onLocal?.(true);
      } else o.onLocal?.(false);
    } catch {
      o.onLocal?.(false);
    }
    rec.onstart = () => o.onStateChange?.(true);
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) o.onFinal(text);
        else interim += `${text} `;
      }
      o.onInterim?.(interim.trim());
      restarts = 0;
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const kind: SttError = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error === 'network' ? 'network' : 'other';
      if (kind === 'not-allowed' || kind === 'network') active = false;
      o.onError?.(kind);
    };
    rec.onend = () => {
      o.onInterim?.('');
      if (active && o.continuous && restarts < 50) {
        restarts++;
        setTimeout(() => active && begin(), 150);
      } else {
        o.onStateChange?.(false);
      }
    };
    if (!active) return;
    try {
      rec.start();
    } catch {
      o.onError?.('other');
    }
  };
  void begin();
  return () => {
    active = false;
    try {
      rec?.stop();
    } catch {
      /* already stopped */
    }
    o.onStateChange?.(false);
  };
}
