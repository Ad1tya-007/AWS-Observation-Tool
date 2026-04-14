import { useParams } from 'react-router-dom';
import { RequestDetailError } from '@/components/request-detail/request-detail-error';
import { RequestDetailLoading } from '@/components/request-detail/request-detail-loading';
import { RequestDetailView } from '@/components/request-detail/request-detail-view';
import { useRequestDetail } from '@/components/request-detail/use-request-detail';
import { useAppUi } from '@/context/app-ui-context';

export function RequestDetailPage() {
  const { requestId: rawId } = useParams<{ requestId: string }>();
  const requestId = rawId ? decodeURIComponent(rawId) : undefined;

  const { demoOllamaDown, setDemoOllamaDown, lastFetchParams, selectedModel } = useAppUi();

  const {
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
  } = useRequestDetail(requestId, lastFetchParams, selectedModel, demoOllamaDown);

  if (isLoading) {
    return <RequestDetailLoading />;
  }

  if (fetchError) {
    return <RequestDetailError fetchError={fetchError} requestId={requestId} />;
  }

  if (!detail) {
    return null;
  }

  return (
    <RequestDetailView
      detail={detail}
      selectedOpId={selectedOpId}
      onSelectOpId={setSelectedOpId}
      timelineFilterNote={timelineFilterNote}
      onTimelineFilter={onTimelineFilter}
      aiInsight={ollamaInsight}
      selectedModel={selectedModel}
      ollamaLoading={ollamaLoading}
      ollamaError={ollamaError}
      demoOllamaBlocked={demoOllamaDown}
      onInsightRetry={() => {
        if (demoOllamaDown) {
          setDemoOllamaDown(false);
        } else {
          retryOllamaInsight();
        }
      }}
    />
  );
}
