import { formatDistanceToNow } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CopyIcon,
  GlobeIcon,
  Loader2Icon,
  RadarIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { LogGroupPicker } from '@/components/observability/log-group-picker';
import { MiniTimelineStrip } from '@/components/observability/mini-timeline-strip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAppUi } from '@/context/app-ui-context';
import {
  type AwsLogGroup,
  type ObservedRequest,
  fetchObservedRequests,
  listLogGroups,
} from '@/lib/aws-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const timePresets = [
  { id: '15m', label: '15m', ms: 15 * 60 * 1_000 },
  { id: '1h', label: '1h', ms: 60 * 60 * 1_000 },
  { id: '6h', label: '6h', ms: 6 * 60 * 60 * 1_000 },
] as const;

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'us-east-2', label: 'us-east-2 (Ohio)' },
  { value: 'us-west-1', label: 'us-west-1 (N. California)' },
  { value: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
  { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
  { value: 'sa-east-1', label: 'sa-east-1 (São Paulo)' },
  { value: 'ca-central-1', label: 'ca-central-1 (Canada)' },
  { value: 'ap-southeast-2', label: 'ap-southeast-2 (Sydney)' },
  { value: 'ap-northeast-2', label: 'ap-northeast-2 (Seoul)' },
  { value: 'ap-northeast-3', label: 'ap-northeast-3 (Osaka)' },
  { value: 'ap-northeast-4', label: 'ap-northeast-4 (Tokyo)' },
  {
    value: 'ap-northeast-5',
    label: 'us-west-3 (Los Angeles)',
  },
  { value: 'us-west-4', label: 'us-west-4 (Las Vegas)' },
  { value: 'us-east-3', label: 'us-east-3 (Ohio)' },
  { value: 'us-east-4', label: 'us-east-4 (N. Virginia)' },
  { value: 'us-east-5', label: 'us-east-5 (N. Virginia)' },
  { value: 'us-east-6', label: 'us-east-6 (N. Virginia)' },
  { value: 'us-east-7', label: 'us-east-7 (N. Virginia)' },
  { value: 'us-east-8', label: 'us-east-8 (N. Virginia)' },
  { value: 'us-east-9', label: 'us-east-9 (N. Virginia)' },
  { value: 'us-east-10', label: 'us-east-10 (N. Virginia)' },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusCell({ row }: { row: ObservedRequest }) {
  if (row.errorCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-destructive"
        title={`${row.errorCount} error(s)`}>
        <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">
          Errors <span className="sr-only">({row.errorCount})</span>
        </span>
      </span>
    );
  }
  if (row.warningCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-amber-400"
        title={`${row.warningCount} warning(s)`}>
        <AlertTriangleIcon className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium">
          Warnings <span className="sr-only">({row.warningCount})</span>
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-400">
      <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-xs font-medium">Healthy</span>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const {
    demoSsoExpired,
    setDemoSsoExpired,
    activeProfile,
    activeRegion,
    setActiveRegion,
    setLastFetchParams,
    setLastFetchedRequests,
  } = useAppUi();

  // Log group picker state
  const [availableGroups, setAvailableGroups] = useState<AwsLogGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Query / fetch state
  const [timePreset, setTimePreset] = useState<string>('15m');
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ObservedRequest[]>([]);
  const [hasData, setHasData] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Abort controller ref so we can cancel in-flight group fetches
  const groupFetchRef = useRef<AbortController | null>(null);

  // ── Load log groups whenever profile or region changes ──────────────────────
  const loadLogGroups = useCallback(async () => {
    groupFetchRef.current?.abort();
    const controller = new AbortController();
    groupFetchRef.current = controller;

    setIsLoadingGroups(true);
    setAvailableGroups([]);
    setSelectedGroupIds([]);
    setHasData(false);
    setRows([]);
    setFetchError(null);

    try {
      const groups = await listLogGroups({
        profile: activeProfile,
        region: activeRegion,
      });
      if (controller.signal.aborted) return;
      setAvailableGroups(groups);
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = String(err);
      if (msg.includes('SessionExpired')) {
        setDemoSsoExpired(true);
      } else {
        toast.error('Failed to load log groups', { description: msg });
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingGroups(false);
      }
    }
  }, [activeProfile, activeRegion, setDemoSsoExpired]);

  useEffect(() => {
    void loadLogGroups();
    return () => groupFetchRef.current?.abort();
  }, [loadLogGroups]);

  // ── Fetch log events ─────────────────────────────────────────────────────────
  async function handleFetch() {
    if (selectedGroupIds.length === 0) return;
    setIsLoading(true);
    setFetchError(null);

    const preset =
      timePresets.find((p) => p.id === timePreset) ?? timePresets[0];
    const endTimeMs = Date.now();
    const startTimeMs = endTimeMs - preset.ms;

    try {
      const results = await fetchObservedRequests({
        logGroupNames: selectedGroupIds,
        startTimeMs,
        endTimeMs,
        profile: activeProfile,
        region: activeRegion,
      });
      setRows(results);
      setHasData(true);
      // Persist results + context so the detail page and command palette can use them
      setLastFetchedRequests(results);
      setLastFetchParams({
        logGroupNames: selectedGroupIds,
        startTimeMs,
        endTimeMs,
        profile: activeProfile,
        region: activeRegion,
      });
      toast.success(
        `Loaded ${results.length} request${results.length === 1 ? '' : 's'}`,
        {
          description: `${selectedGroupIds.length} log group${selectedGroupIds.length === 1 ? '' : 's'} · last ${preset.label}`,
        },
      );
    } catch (err) {
      const msg = String(err);
      if (msg.includes('SessionExpired')) {
        setDemoSsoExpired(true);
      } else {
        setFetchError(msg);
        toast.error('Fetch failed', { description: msg });
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setHasData(false);
    setRows([]);
    setFetchError(null);
    toast.message('Cleared', { description: 'In-memory results removed.' });
  }

  // ── Filtered table rows ───────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        String(r.servicesTouched).includes(q) ||
        `${r.errorCount}`.includes(q) ||
        `${r.warningCount}`.includes(q),
    );
  }, [rows, tableFilter]);

  const showEmpty = !hasData && !isLoading;
  const timeLabel =
    timePreset === '15m'
      ? '15 minutes'
      : timePreset === '1h'
        ? 'hour'
        : '6 hours';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-8 sm:px-6">
        <header className="space-y-1">
          <h1
            id="requests-heading"
            className="text-2xl font-semibold tracking-tight">
            Observed requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Last {timeLabel}
            {selectedGroupIds.length > 0
              ? ` · ${selectedGroupIds.length} log group${selectedGroupIds.length === 1 ? '' : 's'}`
              : ''}
            {' · '}
            <span className="font-mono text-xs text-muted-foreground/90">
              {activeRegion}
            </span>
            {' · '}
            <span className="font-mono text-xs text-muted-foreground/70">
              {activeProfile}
            </span>
          </p>
        </header>

        {/* SSO expired banner */}
        {demoSsoExpired && (
          <Alert variant="destructive" className="border-destructive/80">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>AWS session expired</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Run{' '}
                <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-xs">
                  aws sso login
                </code>{' '}
                in a terminal, then fetch again.
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0 gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText('aws sso login');
                  toast.success('Copied to clipboard');
                }}>
                <CopyIcon className="size-3.5" />
                Copy command
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Fetch error banner */}
        {fetchError && !demoSsoExpired && (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>Fetch error</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {fetchError}
            </AlertDescription>
          </Alert>
        )}

        {/* Query controls toolbar */}
        <div
          className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:flex-row sm:items-center sm:justify-between"
          role="search"
          aria-label="Log query controls">
          <div className="flex flex-wrap items-center gap-2">
            {/* Region selector */}
            <Select
              value={activeRegion}
              onValueChange={(v) => setActiveRegion(v)}
              disabled={isLoading}>
              <SelectTrigger
                size="sm"
                className="h-9 w-auto min-w-36 border-border/80 bg-card/40 font-mono text-xs"
                aria-label="AWS region">
                <GlobeIcon className="mr-1.5 size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AWS_REGIONS.map((r) => (
                  <SelectItem
                    key={r.value}
                    value={r.value}
                    className="font-mono text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <LogGroupPicker
              logGroups={availableGroups}
              selected={selectedGroupIds}
              onChange={setSelectedGroupIds}
              disabled={isLoading}
              isLoading={isLoadingGroups}
            />

            <ToggleGroup
              type="single"
              value={timePreset}
              onValueChange={(v) => v && setTimePreset(v)}
              variant="outline"
              size="sm"
              className="justify-start"
              aria-label="Time range preset">
              {timePresets.map((p) => (
                <ToggleGroupItem
                  key={p.id}
                  value={p.id}
                  className="px-3 text-xs">
                  {p.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={
                isLoading ||
                demoSsoExpired ||
                selectedGroupIds.length === 0 ||
                isLoadingGroups
              }
              onClick={() => void handleFetch()}
              aria-busy={isLoading}
              className="gap-2 bg-linear-to-r from-cyan-600 to-violet-600 text-white shadow-md shadow-cyan-500/10 hover:from-cyan-500 hover:to-violet-500">
              {isLoading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  <span>Fetching…</span>
                </>
              ) : (
                <>
                  <RadarIcon className="size-4" aria-hidden />
                  Fetch / Refresh
                </>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasData || isLoading}
                  className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2Icon className="size-4" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear in-memory results?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the current request list from the session. No
                    files are written.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear}>
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-card/30 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
          </div>
        )}

        {/* Empty state */}
        {showEmpty && !isLoading && (
          <Empty className="min-h-[320px] border border-dashed border-border/70 bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RadarIcon className="text-cyan-300" />
              </EmptyMedia>
              <EmptyTitle>No requests loaded</EmptyTitle>
              <EmptyDescription>
                {isLoadingGroups
                  ? 'Loading log groups from AWS…'
                  : availableGroups.length === 0
                    ? 'No log groups found. Check your profile and region.'
                    : 'Choose log groups and a time range, then fetch.'}
              </EmptyDescription>
            </EmptyHeader>
            {!isLoadingGroups && availableGroups.length > 0 && (
              <EmptyContent>
                <Button
                  type="button"
                  onClick={() => void handleFetch()}
                  disabled={demoSsoExpired || selectedGroupIds.length === 0}
                  className="bg-linear-to-r from-cyan-600 to-violet-600 text-white hover:from-cyan-500 hover:to-violet-500">
                  Fetch logs
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}

        {/* Results table */}
        {hasData && !isLoading && (
          <section aria-labelledby="requests-heading" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-md flex-1 space-y-1.5">
                <Label
                  htmlFor="requests-table-filter"
                  className="text-xs text-muted-foreground">
                  Filter requests
                </Label>
                <Input
                  id="requests-table-filter"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="Request id, service count, errors…"
                  autoComplete="off"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Showing{' '}
                <span className="font-mono font-medium text-foreground">
                  {filteredRows.length}
                </span>{' '}
                of{' '}
                <span className="font-mono font-medium text-foreground">
                  {rows.length}
                </span>{' '}
                requests
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/20 shadow-sm ring-1 ring-border/40">
              <Table className="min-w-[640px]">
                <caption className="sr-only">
                  Correlated CloudWatch requests. Columns include trace summary,
                  id, health, error and warning counts, distinct services,
                  operation count, and last seen time.
                </caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Trace
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Request ID
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Err
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Warn
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Services
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Ops
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last seen
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Open trace
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.12,
                        delay: reduceMotion ? 0 : index * 0.03,
                        ease: 'easeOut',
                      }}
                      className="group border-border/40 border-b transition-colors hover:bg-muted/40">
                      <TableCell className="align-middle">
                        <MiniTimelineStrip segments={row.segments} />
                      </TableCell>
                      <TableCell className="align-middle font-mono text-xs">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            to={`/requests/${encodeURIComponent(row.id)}`}
                            className="rounded-sm font-mono text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {row.id}
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            onClick={() => {
                              void navigator.clipboard.writeText(row.id);
                              toast.success('Copied request id');
                            }}
                            aria-label={`Copy request id ${row.id}`}>
                            <CopyIcon className="size-3.5" aria-hidden />
                          </Button>
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusCell row={row} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {row.errorCount}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-amber-400/90">
                        {row.warningCount}
                      </TableCell>
                      <TableCell
                        className="text-right font-mono text-xs tabular-nums text-muted-foreground"
                        title="Distinct microservices in this trace">
                        {row.servicesTouched}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {row.opCount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(row.lastSeen), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8">
                          <Link
                            to={`/requests/${encodeURIComponent(row.id)}`}
                            aria-label={`Open trace for ${row.id}`}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
