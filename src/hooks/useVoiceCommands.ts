import { useCallback, useRef, useState } from 'react';
import { listen } from '../lib/speech/stt';
import { parseCommand, type Command } from '../lib/speech/commands';
import { useSettings } from '../state/settings';
import { useApp } from '../state/app';
import { useT } from '../i18n';

/** Push-to-talk voice commands (English or Hindi, following the UI language). */
export function useVoiceCommands(run: (c: Command, heard: string) => void) {
  const t = useT();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (stopRef.current) return;
    const app = useApp.getState();
    if (app.lecture.active && app.lecture.mode === 'live') {
      app.announce('Voice commands pause while live captions are running.');
      return;
    }
    setHeard('');
    setListening(true);
    let done = false;
    stopRef.current = listen({
      lang: useSettings.getState().uiLang === 'hi' ? 'hi-IN' : 'en-IN',
      continuous: false,
      onInterim: (text) => text && setHeard(text),
      onFinal: (text) => {
        if (done) return;
        done = true;
        setHeard(text);
        const cmd = parseCommand(text);
        if (cmd) runRef.current(cmd, text);
        else useApp.getState().announce(`${t('heard')}: “${text}”. ${t('notUnderstood')}`);
        stop();
      },
      onError: (e) => {
        useApp.getState().announce(e === 'not-allowed' ? t('micBlocked') : e === 'network' ? t('networkError') : e === 'unsupported' ? t('sttUnsupported') : 'Voice command failed. Try again.');
        stop();
      },
      onStateChange: (on) => {
        if (!on) {
          stopRef.current = null;
          setListening(false);
        }
      },
    });
  }, [stop, t]);

  const toggle = useCallback(() => (stopRef.current ? stop() : start()), [start, stop]);

  return { listening, heard, start, stop, toggle };
}
