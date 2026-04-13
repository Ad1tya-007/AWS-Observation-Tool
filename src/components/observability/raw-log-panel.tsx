import { SearchIcon, WrapTextIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import type { LogLine } from "@/lib/aws-api";
import { cn } from "@/lib/utils";

const levels = ["ERROR", "WARN", "INFO", "DEBUG"] as const;

function lineClass(level: LogLine["level"]) {
  if (level === "ERROR") return "text-red-300";
  if (level === "WARN") return "text-amber-300";
  if (level === "DEBUG") return "text-muted-foreground";
  return "text-foreground/90";
}

export function RawLogPanel({
  logs,
  highlightOpId,
}: {
  logs: LogLine[];
  highlightOpId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [wrap, setWrap] = useState(true);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    ERROR: true,
    WARN: true,
    INFO: true,
    DEBUG: false,
  });
  const firstLineRefForOp = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          document.getElementById("log-search")?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!highlightOpId) return;
    const el = firstLineRefForOp.current[highlightOpId];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightOpId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (!enabled[l.level]) return false;
      if (!q) return true;
      return l.text.toLowerCase().includes(q);
    });
  }, [logs, query, enabled]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/50 pb-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="log-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs…"
            className="h-9 pl-9 font-mono text-xs"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            /
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {levels.map((lvl) => (
            <label key={lvl} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={enabled[lvl]}
                onCheckedChange={(v) =>
                  setEnabled((prev) => ({ ...prev, [lvl]: Boolean(v) }))
                }
              />
              {lvl}
            </label>
          ))}
          <div className="flex items-center gap-2 border-l border-border/50 pl-3">
            <WrapTextIcon className="size-4 text-muted-foreground" aria-hidden />
            <Label htmlFor="wrap-lines" className="text-xs text-muted-foreground">
              Wrap
            </Label>
            <Switch id="wrap-lines" checked={wrap} onCheckedChange={setWrap} />
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border/60 bg-muted/20 shadow-inner">
        <div className="p-3 font-mono text-[11px] leading-relaxed">
          {filtered.map((line) => {
            const flash = line.opId === highlightOpId;
            return (
              <div
                key={line.id}
                ref={(el) => {
                  if (!line.opId) return;
                  if (!firstLineRefForOp.current[line.opId]) {
                    firstLineRefForOp.current[line.opId] = el;
                  }
                }}
                className={cn(
                  "border-l-2 border-transparent py-0.5 pl-2",
                  flash && "border-l-foreground/25 bg-muted/40",
                  wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto",
                )}
              >
                <span className={cn("mr-2 select-none opacity-60", lineClass(line.level))}>
                  [{line.level}]
                </span>
                <span className={lineClass(line.level)}>{line.text}</span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <p role="status" aria-live="polite" className="sr-only">
        {filtered.length} log line{filtered.length === 1 ? "" : "s"} match current filters
      </p>
    </div>
  );
}
