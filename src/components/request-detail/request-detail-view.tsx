import { motion, useReducedMotion } from 'framer-motion';
import { CopyIcon, ListTreeIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AiInsightPanel } from '@/components/observability/ai-insight-panel';
import { RawLogPanel } from '@/components/observability/raw-log-panel';
import { TimelineStepper } from '@/components/observability/timeline-stepper';
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
import type { AiInsight, RequestDetail } from '@/lib/aws-api';

type RequestDetailViewProps = {
  detail: RequestDetail;
  selectedOpId: string | null;
  onSelectOpId: (id: string) => void;
  timelineFilterNote: string;
  onTimelineFilter: (shown: number, total: number) => void;
  /** Only set after Ollama returns; never backend heuristics. */
  aiInsight: AiInsight | null;
  selectedModel: string;
  ollamaLoading: boolean;
  ollamaError: string | null;
  demoOllamaBlocked: boolean;
  onInsightRetry: () => void;
};

export function RequestDetailView({
  detail,
  selectedOpId,
  onSelectOpId,
  timelineFilterNote,
  onTimelineFilter,
  aiInsight,
  selectedModel,
  ollamaLoading,
  ollamaError,
  demoOllamaBlocked,
  onInsightRetry,
}: RequestDetailViewProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6"
      aria-labelledby="trace-page-title"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
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
        </div>
      </div>

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
                      onSelect={onSelectOpId}
                      onFilterResult={onTimelineFilter}
                    />
                  </div>
                </section>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={42} minSize={28} className="min-h-0">
                <div
                  className="h-full min-h-0 overflow-y-auto p-4"
                  role="region"
                  aria-label="AI insight for this trace"
                >
                  <AiInsightPanel
                    insight={aiInsight}
                    modelLabel={selectedModel}
                    isOllamaLoading={ollamaLoading}
                    ollamaError={ollamaError}
                    demoOllamaBlocked={demoOllamaBlocked}
                    onRetry={onInsightRetry}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

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
