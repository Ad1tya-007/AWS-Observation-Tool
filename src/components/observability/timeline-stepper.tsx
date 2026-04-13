import { motion, useReducedMotion } from 'framer-motion';
import {
  DatabaseIcon,
  GlobeIcon,
  ListOrderedIcon,
  TimerIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OpKind, TimelineOp } from '@/lib/aws-api';
import { cn } from '@/lib/utils';

function OpIcon({ kind }: { kind: OpKind }) {
  if (kind === 'db') return <DatabaseIcon className="size-4" aria-hidden />;
  if (kind === 'queue')
    return <ListOrderedIcon className="size-4" aria-hidden />;
  return <GlobeIcon className="size-4" aria-hidden />;
}

function opAriaLabel(op: TimelineOp): string {
  const status =
    op.state === 'error'
      ? 'Error'
      : op.state === 'warning'
        ? 'Warning, slow or degraded'
        : 'Success';
  const lat = op.latencyMs != null ? `, ${op.latencyMs} ms latency` : '';
  const http = op.httpStatus != null ? `, HTTP ${op.httpStatus}` : '';
  return `${op.service}, ${op.endpoint}. ${status}${http}${lat}.`;
}

export function TimelineStepper({
  ops,
  selectedId,
  onSelect,
  onFilterResult,
}: {
  ops: TimelineOp[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFilterResult?: (shown: number, total: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const filterId = useId();
  const opRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterText, setFilterText] = useState('');
  const [jumpService, setJumpService] = useState<string>('__all__');

  const uniqueServices = useMemo(() => {
    const s = new Set(ops.map((o) => o.service));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [ops]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return ops;
    return ops.filter(
      (o) =>
        o.service.toLowerCase().includes(q) ||
        o.endpoint.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    );
  }, [ops, filterText]);

  useEffect(() => {
    onFilterResult?.(filtered.length, ops.length);
  }, [filtered.length, ops.length, onFilterResult]);

  function scrollOpIntoView(id: string) {
    requestAnimationFrame(() => {
      opRefs.current[id]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    });
  }

  function handleJumpService(svc: string) {
    setJumpService(svc);
    if (!svc || svc === '__all__') return;
    const first = ops.find((o) => o.service === svc);
    if (first) {
      onSelect(first.id);
      scrollOpIntoView(first.id);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="sticky top-0 z-1 flex flex-col gap-2 bg-background/95 pb-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-top">
          <div className="min-w-0 flex-1 space-y-1.5 items-center">
            <Label
              htmlFor={filterId}
              className="text-xs font-medium text-muted-foreground">
              Filter operations
            </Label>
            <Input
              id={filterId}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Service, endpoint, or operation id…"
              autoComplete="off"
              className="h-9 font-mono text-xs"
              aria-describedby={`${filterId}-hint`}
            />
            <p
              id={`${filterId}-hint`}
              className="text-[10px] text-muted-foreground">
              Narrows the list when you have many microservices. Screen readers:
              results count updates below the timeline.
            </p>
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-[220px] items-end">
            <Label
              htmlFor="jump-service"
              className="text-xs font-medium text-muted-foreground">
              Jump to service
            </Label>
            <Select
              value={jumpService}
              onValueChange={(v) => handleJumpService(v)}>
              <SelectTrigger
                id="jump-service"
                className="h-9 font-mono text-xs"
                aria-label="Jump to microservice">
                <SelectValue placeholder="Choose service…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="font-mono text-xs">
                  All services
                </SelectItem>
                {uniqueServices.map((svc) => (
                  <SelectItem
                    key={svc}
                    value={svc}
                    className="font-mono text-xs">
                    {svc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <output className="text-xs text-muted-foreground" aria-live="polite">
            Showing{' '}
            <span className="font-mono tabular-nums text-foreground">
              {filtered.length}
            </span>{' '}
            of{' '}
            <span className="font-mono tabular-nums text-foreground">
              {ops.length}
            </span>{' '}
            operations
          </output>
          {filterText ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterText('')}>
              Clear filter
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1"
        role="region"
        aria-label="Operation timeline list">
        <div>
          <ol className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <li className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No operations match this filter. Clear the filter or pick a
                service from “Jump to service”.
              </li>
            ) : (
              filtered.map((op, index) => {
                const isSelected = selectedId === op.id;
                const border =
                  op.state === 'error'
                    ? 'border-l-[3px] border-l-destructive bg-destructive/[0.06]'
                    : op.state === 'warning'
                      ? 'border-l-[3px] border-l-amber-500/80 bg-amber-500/[0.06]'
                      : 'border-l-[3px] border-l-emerald-600/70 bg-emerald-500/[0.05]';

                return (
                  <motion.li
                    key={op.id}
                    initial={
                      reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.2,
                      delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035,
                      ease: 'easeOut',
                    }}>
                    <button
                      ref={(el) => {
                        opRefs.current[op.id] = el;
                      }}
                      type="button"
                      onClick={() => onSelect(op.id)}
                      aria-pressed={isSelected}
                      aria-label={opAriaLabel(op)}
                      className={cn(
                        'group relative flex w-full min-h-18 flex-col gap-2 rounded-xl border border-border/50 bg-background/30 p-4 text-left shadow-none transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        border,
                        isSelected && 'bg-muted/40 ring-1 ring-border/90',
                      )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background/60 ring-1 ring-border/60">
                            <OpIcon kind={op.kind} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {op.service}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {op.endpoint}
                            </p>
                            <p className="sr-only">Operation id {op.id}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {op.httpStatus != null && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'font-mono text-[10px]',
                                op.httpStatus >= 500 &&
                                  'border-destructive/40 bg-destructive/15 text-destructive',
                                op.httpStatus >= 200 &&
                                  op.httpStatus < 300 &&
                                  'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                              )}>
                              {op.httpStatus}
                            </Badge>
                          )}
                          {op.latencyMs != null && (
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] tabular-nums">
                              {op.latencyMs}ms
                              {op.state === 'warning' && (
                                <TimerIcon
                                  className="ml-1 inline size-3 text-amber-400"
                                  aria-hidden
                                />
                              )}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.li>
                );
              })
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
