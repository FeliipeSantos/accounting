import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { intelligenceApi } from '@/modules/intelligence/api';
import { describeFinishedRun, formatTime } from '@/modules/intelligence/format';
import type { Run, RunState } from '@/modules/intelligence/types';

const POLL_MS = 3000;

export interface RunNotice {
  text: string;
  tone: 'info' | 'warning';
}

/**
 * State of the "Atualizar agora" collection: asks the server while a run is active
 * (any origin, also the daily one) and reports when it ends.
 */
export function useRunStatus(sourceName: (id: string) => string, onFinished: (run: Run) => void) {
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<RunNotice | null>(null);
  // última resposta de /status: alimenta a linha "Última coleta" do cabeçalho
  const [state, setState] = useState<RunState | null>(null);
  const watching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  const nameRef = useRef(sourceName);
  nameRef.current = sourceName;

  const check = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const status = await intelligenceApi.status();
      setState(status);
      if (status.running) {
        watching.current = true;
        setRunning(true);
        setNotice({
          text: `Coleta em andamento desde ${formatTime(status.lastRun?.startedAt)}. As fontes oficiais podem levar até um minuto para responder.`,
          tone: 'info',
        });
        timer.current = setTimeout(() => void check(), POLL_MS);
        return;
      }
      setRunning(false);
      if (watching.current && status.lastRun) {
        watching.current = false;
        // sucesso já aparece na linha "Última coleta" do cabeçalho; o aviso fica só para falhas
        setNotice(status.lastRun.status === 'success' ? null : { text: describeFinishedRun(status.lastRun, nameRef.current), tone: 'warning' });
        finishedRef.current(status.lastRun);
      }
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) setNotice({ text: `Não foi possível consultar a coleta: ${errorMessage(error)}`, tone: 'warning' });
    }
  }, []);

  useEffect(() => {
    void check();
    return () => clearTimeout(timer.current);
  }, [check]);

  const start = useCallback(async () => {
    setRunning(true);
    try {
      await intelligenceApi.startRun();
      watching.current = true;
    } catch (error) {
      // 409 (já em andamento) ou 429 (intervalo mínimo entre coletas manuais)
      if (!(error instanceof SessionExpiredError)) setNotice({ text: errorMessage(error), tone: 'warning' });
    }
    void check();
  }, [check]);

  return { running, notice, start, state };
}
