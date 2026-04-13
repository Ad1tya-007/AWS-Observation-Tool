import { ChevronDownIcon, LayersIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AwsLogGroup } from "@/lib/aws-api";
import { cn } from "@/lib/utils";

const MAX_MATCH_ROWS = 120;

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function matchesQuery(g: AwsLogGroup, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = `${g.name} ${g.service} ${g.cluster} ${g.region}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

function groupByCluster(groups: AwsLogGroup[]): Map<string, AwsLogGroup[]> {
  const m = new Map<string, AwsLogGroup[]>();
  for (const g of groups) {
    const list = m.get(g.cluster) ?? [];
    list.push(g);
    m.set(g.cluster, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.service.localeCompare(b.service));
  }
  return new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function LogGroupPicker({
  logGroups,
  selected,
  onChange,
  disabled,
  isLoading,
}: {
  logGroups: AwsLogGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const clusters = useMemo(() => {
    const s = new Set(logGroups.map((g) => g.cluster));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [logGroups]);

  const countByCluster = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of logGroups) {
      m[g.cluster] = (m[g.cluster] ?? 0) + 1;
    }
    return m;
  }, [logGroups]);

  const tokens = useMemo(() => tokenize(query), [query]);

  const filtered = useMemo(() => {
    let base = logGroups;
    if (clusterFilter !== "all") {
      base = base.filter((g) => g.cluster === clusterFilter);
    }
    if (tokens.length === 0) return base;
    return logGroups.filter((g) => matchesQuery(g, tokens));
  }, [logGroups, clusterFilter, tokens]);

  const showClusterBrowser = clusterFilter === "all" && tokens.length === 0;

  const selectedGroups = useMemo(() => {
    const set = new Set(selected);
    return logGroups.filter((g) => set.has(g.id));
  }, [logGroups, selected]);

  const groupedForList = useMemo(() => {
    if (showClusterBrowser) return new Map<string, AwsLogGroup[]>();
    const list = tokens.length > 0 ? filtered.slice(0, MAX_MATCH_ROWS) : filtered;
    return groupByCluster(list);
  }, [filtered, showClusterBrowser, tokens.length]);

  const truncated = tokens.length > 0 && filtered.length > MAX_MATCH_ROWS;

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const totalGroups = logGroups.length;

  const summary = isLoading
    ? "Loading groups…"
    : selected.length === 0
      ? "Log groups"
      : selected.length === totalGroups && totalGroups > 0
        ? "All log groups"
        : `${selected.length} group${selected.length === 1 ? "" : "s"}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setClusterFilter("all");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isLoading}
          aria-label={`CloudWatch log groups, ${summary}`}
          aria-expanded={open}
          className={cn(
            "h-9 min-w-44 justify-between border-border/80 bg-card/40 font-normal sm:min-w-52",
            selected.length > 0 && "border-cyan-500/30 bg-cyan-500/5",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {isLoading ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <LayersIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{summary}</span>
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="flex max-h-[min(90vh,36rem)] w-[min(100vw-1.5rem,28rem)] flex-col gap-0 overflow-hidden p-0"
        align="start"
      >
        <div className="shrink-0 border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            CloudWatch log groups
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground/90">
            {isLoading
              ? "Fetching log groups from AWS…"
              : `${totalGroups} group${totalGroups === 1 ? "" : "s"} — search or pick a cluster to narrow.`}
          </p>
        </div>

        <div className="shrink-0 space-y-2 border-b px-3 py-2">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, service, cluster, region…"
              className="h-9 border-border/80 bg-muted/20 pr-3 pl-9 text-sm"
              aria-label="Filter log groups"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              Cluster
            </span>
            <Select
              value={clusterFilter}
              onValueChange={setClusterFilter}
              disabled={tokens.length > 0}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-full min-w-0 border-border/80 bg-muted/15 sm:max-w-[16rem]"
                aria-label="Filter by ECS cluster"
              >
                <SelectValue placeholder="Cluster" />
              </SelectTrigger>
              <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
                <SelectItem value="all">All clusters</SelectItem>
                {clusters.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}{" "}
                    <span className="text-muted-foreground">({countByCluster[c] ?? 0})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tokens.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Cluster filter is ignored while searching; results match across every group.
            </p>
          )}
        </div>

        {selectedGroups.length > 0 && (
          <div className="shrink-0 border-b px-3 py-2">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              Selected ({selectedGroups.length})
            </p>
            <ul className="flex max-h-20 flex-col gap-1 overflow-y-auto text-[11px]">
              {selectedGroups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start gap-2 rounded-md bg-muted/40 px-2 py-1"
                >
                  <Checkbox
                    checked
                    onCheckedChange={() => toggle(g.id)}
                    className="mt-0.5"
                    aria-label={`Remove ${g.service}`}
                  />
                  <span className="min-w-0 font-mono leading-snug">
                    <span className="text-foreground">{g.service}</span>
                    <span className="block truncate text-muted-foreground">
                      {g.cluster} · {g.region}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ScrollArea
          className={cn(
            "min-h-0 w-full shrink-0 overflow-hidden",
            "h-[min(17.5rem,calc(90vh-16rem))] max-h-[min(17.5rem,calc(90vh-16rem))]",
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Loading log groups…
            </div>
          ) : showClusterBrowser ? (
            <div className="space-y-1 p-2">
              <p className="px-1 pb-1 text-[11px] text-muted-foreground">Browse by cluster</p>
              {clusters.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No log groups found. Check your profile and region.
                </p>
              ) : (
                clusters.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setClusterFilter(c)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-2.5 text-left text-sm transition-colors hover:border-border/80 hover:bg-muted/50"
                  >
                    <span className="min-w-0 truncate font-medium">{c}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {countByCluster[c] ?? 0} svc
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {groupedForList.size === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No log groups match your filters.
                </p>
              ) : (
                [...groupedForList.entries()].map(([cluster, groups]) => (
                  <div key={cluster} className="mb-3 last:mb-0">
                    <p className="sticky top-0 z-1 bg-popover px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {cluster}
                    </p>
                    <div className="flex flex-col gap-1">
                      {groups.map((g) => {
                        const checked = selected.includes(g.id);
                        return (
                          <label
                            key={g.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-muted/50",
                              checked && "border-border/80 bg-muted/30",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggle(g.id)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-mono text-xs leading-snug">
                                {g.service}
                              </span>
                              <span className="line-clamp-2 text-[10px] text-muted-foreground">
                                {g.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground/90">
                                {g.region}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
              {truncated && (
                <p className="px-2 pt-1 text-center text-[11px] text-amber-600 dark:text-amber-400">
                  Showing first {MAX_MATCH_ROWS} matches — type a more specific query.
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/80 bg-popover px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={logGroups.length === 0}
            onClick={() => onChange(logGroups.map((g) => g.id))}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
