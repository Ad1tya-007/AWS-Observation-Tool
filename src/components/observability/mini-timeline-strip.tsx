import { cn } from "@/lib/utils";
import type { StripSegment } from "@/lib/aws-api";

function stripSummary(segments: StripSegment[]) {
  const err = segments.filter((s) => s.type === "error").reduce((a, s) => a + s.ratio, 0);
  const warn = segments.filter((s) => s.type === "warning").reduce((a, s) => a + s.ratio, 0);
  const ok = segments.filter((s) => s.type === "success").reduce((a, s) => a + s.ratio, 0);
  return `Trace mix: approximately ${Math.round(err * 100)} percent errors, ${Math.round(warn * 100)} percent warnings, ${Math.round(ok * 100)} percent success.`;
}

export function MiniTimelineStrip({ segments }: { segments: StripSegment[] }) {
  return (
    <div
      role="img"
      aria-label={stripSummary(segments)}
      className="flex h-1.5 w-full max-w-[128px] overflow-hidden rounded-full bg-muted/60 ring-1 ring-border/40"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn(
            "h-full min-w-[3px] transition-all",
            s.type === "error" && "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.35)]",
            s.type === "warning" && "bg-amber-400/90",
            s.type === "success" && "bg-emerald-500/95",
          )}
          style={{ flexGrow: s.ratio, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}
