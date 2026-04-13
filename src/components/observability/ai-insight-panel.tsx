import { BrainCircuitIcon, SparklesIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiInsight } from "@/lib/aws-api";
import { cn } from "@/lib/utils";

export function AiInsightPanel({
  insight,
  ollamaOffline,
  onRetry,
}: {
  insight: AiInsight;
  ollamaOffline: boolean;
  onRetry?: () => void;
}) {
  if (ollamaOffline) {
    return (
      <Card className="border-amber-500/40 bg-card/60 backdrop-blur-md">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <SparklesIcon className="size-4 text-violet-300" />
            AI insight
          </CardTitle>
          <CardDescription>Local Ollama runtime</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-100">
            <AlertTitle>Ollama unreachable</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                Start the local server (typically{" "}
                <code className="rounded bg-background/80 px-1 font-mono text-xs">http://127.0.0.1:11434</code>
                ).
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                Retry (demo)
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
            Local model
          </span>
        </div>
        <CardDescription className="text-xs">
          Generated from structured trace — not sent to the cloud.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Confidence</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-semibold text-foreground">
                  {insight.confidenceLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Heuristic score from the local model — not a guarantee. Use as a hint.
              </TooltipContent>
            </Tooltip>
          </div>
          <Progress value={insight.confidence * 100} className="h-2 bg-muted/60" />
          <p className="text-[10px] text-muted-foreground">
            Scalar: {(insight.confidence * 100).toFixed(0)}% · model-dependent
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
