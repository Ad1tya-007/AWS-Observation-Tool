import { BrainCircuitIcon, Loader2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AiInsight } from "@/lib/aws-api";
import { cn } from "@/lib/utils";

function InsightSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy aria-label="Generating insight">
      <div className="space-y-2">
        <div className="h-4 w-4/5 max-w-md rounded bg-muted/60" />
        <div className="h-3 w-full rounded bg-muted/40" />
        <div className="h-3 w-11/12 rounded bg-muted/40" />
      </div>
      <Separator className="bg-border/60" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted/50" />
        <div className="h-3 w-full rounded bg-muted/35" />
        <div className="h-3 w-5/6 rounded bg-muted/35" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-muted/50" />
        <div className="h-3 w-full rounded bg-muted/35" />
        <div className="h-3 w-4/5 rounded bg-muted/35" />
      </div>
    </div>
  );
}

export function AiInsightPanel({
  insight,
  modelLabel,
  isOllamaLoading,
  ollamaError,
  demoOllamaBlocked,
  onRetry,
}: {
  /** Populated only after Ollama returns; never rule-based `detail.ai`. */
  insight: AiInsight | null;
  modelLabel: string;
  isOllamaLoading: boolean;
  ollamaError: string | null;
  demoOllamaBlocked: boolean;
  onRetry?: () => void;
}) {
  const showRetry =
    (demoOllamaBlocked || ollamaError) && typeof onRetry === "function";
  const showBodyLoading = isOllamaLoading && !demoOllamaBlocked && !ollamaError;
  const showInsight = insight !== null && !demoOllamaBlocked;

  return (
    <Card
      className={cn(
        "border-border/50 bg-card/70 shadow-lg shadow-cyan-500/5 backdrop-blur-md",
        "ring-1 ring-cyan-500/10",
      )}
    >
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BrainCircuitIcon className="size-5 text-violet-300" aria-hidden />
            AI insight
          </CardTitle>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              showBodyLoading
                ? "bg-cyan-500/15 text-cyan-200"
                : "bg-violet-500/15 text-violet-200",
            )}
          >
            {showBodyLoading ? "Generating…" : `Ollama · ${modelLabel}`}
          </span>
        </div>
        <CardDescription className="text-xs">
          Generated locally with Ollama — trace data stays on your machine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {demoOllamaBlocked && (
          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-100">
            <AlertTitle>Demo: Ollama blocked</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 text-amber-100/90">
              <span>
                Turn off the demo toggle in Settings, or start Ollama at{" "}
                <code className="rounded bg-background/80 px-1 font-mono text-xs">
                  http://127.0.0.1:11434
                </code>
                .
              </span>
              {showRetry && (
                <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {ollamaError && !demoOllamaBlocked && (
          <Alert variant="destructive" className="border-destructive/60 bg-destructive/10">
            <AlertTitle>Could not generate insight</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span className="text-sm opacity-90">{ollamaError}</span>
              {showRetry && (
                <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {showBodyLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 shrink-0 animate-spin text-cyan-300" aria-hidden />
            <span>
              Generating analysis with <span className="font-mono text-foreground">{modelLabel}</span>
              …
            </span>
          </div>
        )}

        {showBodyLoading && <InsightSkeleton />}

        {showInsight && insight && (
          <>
            <div>
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {insight.summaryLead}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.summary}</p>
            </div>

            <Separator className="bg-border/60" />

            <Accordion type="multiple" defaultValue={["root", "fix"]} className="w-full">
              <AccordionItem value="root" className="border-border/60">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:no-underline">
                  Root cause
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                    {insight.rootCause.map((line, i) => (
                      <li key={i} className="leading-relaxed">
                        {line.split(/(`[^`]+`)/g).map((part, j) =>
                          part.startsWith("`") && part.endsWith("`") ? (
                            <code
                              key={j}
                              className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-xs text-foreground"
                            >
                              {part.slice(1, -1)}
                            </code>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fix" className="border-border/60">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:no-underline">
                  Suggested fix
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal space-y-3 pl-4 text-sm text-muted-foreground">
                    {insight.suggestedFix.map((item, i) => (
                      <li key={i} className="space-y-2">
                        <span>{item.step}</span>
                        {item.code && (
                          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-xs text-foreground shadow-inner">
                            {item.code}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
