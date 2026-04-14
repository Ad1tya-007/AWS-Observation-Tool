import { useCallback, useEffect, useRef, useState } from 'react';
import { type FetchParams, type RequestDetail, fetchRequestDetail } from '@/lib/aws-api';

export function useRequestDetail(
  requestId: string | undefined,
  lastFetchParams: FetchParams | null,
) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [timelineFilterNote, setTimelineFilterNote] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const onTimelineFilter = useCallback((shown: number, total: number) => {
    setTimelineFilterNote(
      shown === total
        ? `Timeline shows all ${total} operations.`
        : `Timeline filtered: ${shown} of ${total} operations visible.`,
    );
  }, []);

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

  return {
    detail,
    isLoading,
    fetchError,
    selectedOpId,
    setSelectedOpId,
    timelineFilterNote,
    onTimelineFilter,
  };
}
