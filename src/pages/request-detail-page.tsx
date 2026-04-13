import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CopyIcon,
  ListTreeIcon,
  Loader2Icon,
  RadarIcon,
  SparklesIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AiInsightPanel } from '@/components/observability/ai-insight-panel';
import { RawLogPanel } from '@/components/observability/raw-log-panel';
import { TimelineStepper } from '@/components/observability/timeline-stepper';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppUi } from '@/context/app-ui-context';
import { type RequestDetail, fetchRequestDetail } from '@/lib/aws-api';

export function RequestDetailPage() {
  const { requestId: rawId } = useParams<{ requestId: string }>();
  const requestId = rawId ? decodeURIComponent(rawId) : undefined;

  const reduceMotion = useReducedMotion();
  const { demoOllamaDown, setDemoOllamaDown, lastFetchParams } = useAppUi();

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

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
        <div className="flex-1 space-y-3 rounded-xl border border-border/40 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
          <Skeleton className="h-10 w-4/6" />
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Fetching trace from CloudWatch…
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────────
  if (fetchError) {
    const isNoContext = fetchError === 'no-context';
    const isNotFound = fetchError === 'not-found';

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        {isNoContext ? (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <RadarIcon className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No active session found. Go back to the dashboard, select log groups and fetch logs
              first — then open a trace.
            </p>
          </div>
        ) : isNotFound ? (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <AlertCircleIcon className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No events found for request{' '}
              <code className="rounded bg-muted/50 px-1.5 font-mono text-xs">{requestId}</code> in
              the selected log groups and time window.
            </p>
          </div>
        ) : (
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>Failed to load trace</AlertTitle>
            <AlertDescription className="font-mono text-xs">{fetchError}</AlertDescription>
          </Alert>
        )}
        <Button asChild variant="outline">
          <Link to="/" className="gap-2">
            <ArrowLeftIcon className="size-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  // ── No detail yet (shouldn't happen after load, but guards the render below) ─
  if (!detail) {
    return null;
  }

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6"
      aria-labelledby="trace-page-title"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Requests</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-88 truncate font-mono text-xs text-foreground">
                  {detail.id}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="trace-page-title" className="text-xl font-semibold tracking-tight">
              Request trace
            </h1>
            <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {detail.opCount} events · {detail.timeline.length} service
              {detail.timeline.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              void navigator.clipboard.writeText(detail.id);
              toast.success('Copied request id');
            }}
            aria-label={`Copy request id ${detail.id}`}
          >
            <CopyIcon className="size-3.5" aria-hidden />
            Copy ID
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-linear-to-r from-cyan-600 to-violet-600 text-white hover:from-cyan-500 hover:to-violet-500"
            onClick={() =>
              toast.message('Ollama integration coming soon', {
                description: 'AI analysis will use your local Ollama model.',
              })
            }
            aria-label="Run AI analysis for this request"
          >
            <SparklesIcon className="size-3.5" aria-hidden />
            Run AI
          </Button>
        </div>
      </div>

      {/* Resizable layout */}
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          orientation="vertical"
          className="h-full min-h-[480px] rounded-xl border border-border/40 bg-background/40"
          id="observe-detail-v"
        >
          <ResizablePanel defaultSize={72} minSize={45} className="min-h-0">
            <ResizablePanelGroup
              orientation="horizontal"
              id="observe-detail-h"
              className="h-full min-h-0"
            >
              {/* Left: Timeline */}
              <ResizablePanel defaultSize={58} minSize={32} className="min-h-0">
                <section
                  className="flex h-full min-h-0 flex-col gap-3 p-4"
                  aria-labelledby="timeline-heading"
                >
                  <p className="sr-only" aria-live="polite">
                    {timelineFilterNote}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      id="timeline-heading"
                      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <ListTreeIcon className="size-4 text-muted-foreground" aria-hidden />
                      Timeline
                    </h2>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        OK
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-400" />
                        Slow
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full bg-destructive" />
                        Error
                      </span>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <TimelineStepper
                      ops={detail.timeline}
                      selectedId={selectedOpId}
                      onSelect={(id) => setSelectedOpId(id)}
                      onFilterResult={onTimelineFilter}
                    />
                  </div>
                </section>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right: AI insight */}
              <ResizablePanel defaultSize={42} minSize={28} className="min-h-0">
                <div
                  className="h-full min-h-0 overflow-y-auto p-4"
                  role="region"
                  aria-label="AI insight for this trace"
                >
                  <AiInsightPanel
                    insight={detail.ai}
                    ollamaOffline={demoOllamaDown}
                    onRetry={() => {
                      setDemoOllamaDown(false);
                      toast.success('Demo: Ollama back online');
                    }}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Bottom: Raw logs */}
          <ResizablePanel defaultSize={28} minSize={16} className="min-h-0">
            <div
              className="flex h-full min-h-0 flex-col gap-2 px-4 pt-3 pb-4"
              role="region"
              aria-labelledby="raw-logs-heading"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <h2 id="raw-logs-heading" className="text-sm font-semibold tracking-tight">
                  Raw logs
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  In-memory · {detail.logs.length} line{detail.logs.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <RawLogPanel logs={detail.logs} highlightOpId={selectedOpId} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </motion.div>
  );
}
