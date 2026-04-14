import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AiInsight,
  type FetchParams,
  type RequestDetail,
  fetchRequestDetail,
} from '@/lib/aws-api';
import { generateTraceInsight } from '@/lib/ollama-api';

export function useRequestDetail(
  requestId: string | undefined,
  lastFetchParams: FetchParams | null,
  /** Ollama model name (e.g. from app UI). */
  ollamaModel: string,
  /** When true (Settings demo), skip calling Ollama. */
  ollamaDemoBlocked: boolean,
) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [timelineFilterNote, setTimelineFilterNote] = useState('');

  const [ollamaInsight, setOllamaInsight] = useState<AiInsight | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaRetryToken, setOllamaRetryToken] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const retryOllamaInsight = useCallback(() => {
    setOllamaRetryToken((n) => n + 1);
  }, []);

  const onTimelineFilter = useCallback((shown: number, total: number) => {
    setTimelineFilterNote(
      shown === total
        ? `Timeline shows all ${total} operations.`
        : `Timeline filtered: ${shown} of ${total} operations visible.`,
    );
  }, []);

  useEffect(() => {
    setOllamaRetryToken(0);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    if (!lastFetchParams) {
      setFetchError('no-context');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setDetail(null);
    setFetchError(null);
    setSelectedOpId(null);

    fetchRequestDetail({
      requestId,
      logGroupNames: lastFetchParams.logGroupNames,
      startTimeMs: lastFetchParams.startTimeMs,
      endTimeMs: lastFetchParams.endTimeMs,
      profile: lastFetchParams.profile,
      region: lastFetchParams.region,
    })
      .then((d) => {
        if (controller.signal.aborted) return;
        if (!d) {
          setFetchError('not-found');
          return;
        }
        setDetail(d);
        if (d.timeline.length > 0) {
          setSelectedOpId(d.timeline[0].id);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setFetchError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [requestId, lastFetchParams]);

  useEffect(() => {
    if (!detail) {
      setOllamaInsight(null);
      setOllamaError(null);
      setOllamaLoading(false);
      return;
    }

    if (ollamaDemoBlocked) {
      setOllamaInsight(null);
      setOllamaError(null);
      setOllamaLoading(false);
      return;
    }

    const ac = new AbortController();
    setOllamaLoading(true);
    setOllamaError(null);

    generateTraceInsight({
      model: ollamaModel,
      detail,
      signal: ac.signal,
    })
      .then((insight) => {
        if (!ac.signal.aborted) setOllamaInsight(insight);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setOllamaInsight(null);
        setOllamaError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!ac.signal.aborted) setOllamaLoading(false);
      });

    return () => ac.abort();
  }, [detail, ollamaModel, ollamaDemoBlocked, ollamaRetryToken]);

  return {
    detail,
    isLoading,
    fetchError,
    selectedOpId,
    setSelectedOpId,
    timelineFilterNote,
    onTimelineFilter,
    ollamaInsight,
    ollamaLoading,
    ollamaError,
    retryOllamaInsight,
  };
}
