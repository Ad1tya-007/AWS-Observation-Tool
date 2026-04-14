import type { AiInsight, RequestDetail } from "@/lib/aws-api";

export const OLLAMA_BASE = "http://127.0.0.1:11434";

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface PullProgress {
  status: string;
  percent?: number;
}

export async function checkOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listInstalledModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error("Ollama not available");
  const data = (await res.json()) as { models: OllamaModel[] };
  return data.models ?? [];
}

export async function pullModel(
  name: string,
  onProgress?: (progress: PullProgress) => void,
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, stream: true }),
  });
  if (!res.ok) throw new Error(`Failed to pull model "${name}"`);

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split("\n").filter(Boolean)) {
      try {
        const chunk = JSON.parse(line) as {
          status: string;
          completed?: number;
          total?: number;
        };
        const percent =
          chunk.total && chunk.completed
            ? Math.round((chunk.completed / chunk.total) * 100)
            : undefined;
        onProgress?.({ status: chunk.status, percent });
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to delete model "${name}"`);
}

export function formatModelSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

const MAX_LOG_LINES = 40;
const MAX_LOG_CHARS = 1200;

function truncateLogs(detail: RequestDetail): string {
  const lines = detail.logs.slice(0, MAX_LOG_LINES);
  return lines
    .map((l) => `[${l.level}] ${l.text.slice(0, MAX_LOG_CHARS)}`)
    .join("\n");
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function normalizeConfidenceLabel(v: unknown): "High" | "Medium" | "Low" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("high")) return "High";
  if (s.includes("low")) return "Low";
  return "Medium";
}

function coerceAiInsight(parsed: Record<string, unknown>): AiInsight {
  const summaryLead =
    typeof parsed.summaryLead === "string"
      ? parsed.summaryLead
      : typeof parsed.summary_lead === "string"
        ? parsed.summary_lead
        : "";
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const rootRaw = parsed.rootCause ?? parsed.root_cause;
  const rootCause = Array.isArray(rootRaw)
    ? rootRaw.filter((x): x is string => typeof x === "string")
    : [];
  const fixRaw = parsed.suggestedFix ?? parsed.suggested_fix;
  const suggestedFix = Array.isArray(fixRaw)
    ? fixRaw
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const step = typeof o.step === "string" ? o.step : "";
          const code = typeof o.code === "string" ? o.code : undefined;
          if (!step && !code) return null;
          return { step: step || "See details above.", code };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];
  let confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.65;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    summaryLead: summaryLead || "Analysis",
    summary: summary || "",
    rootCause: rootCause.length > 0 ? rootCause : ["No root-cause bullets returned by the model."],
    suggestedFix:
      suggestedFix.length > 0
        ? suggestedFix
        : [{ step: "Review the timeline and raw logs for this request.", code: undefined }],
    confidence,
    confidenceLabel: normalizeConfidenceLabel(parsed.confidenceLabel ?? parsed.confidence_label),
  };
}

export type GenerateTraceInsightParams = {
  model: string;
  detail: RequestDetail;
  signal?: AbortSignal;
};

/**
 * Calls the local Ollama `/api/chat` endpoint and asks for a structured JSON insight
 * from timeline and log lines only (no precomputed heuristic text).
 */
export async function generateTraceInsight({
  model,
  detail,
  signal,
}: GenerateTraceInsightParams): Promise<AiInsight> {
  const timeline = JSON.stringify(detail.timeline, null, 2);
  const logs = truncateLogs(detail);

  const userPrompt = `You are helping an engineer understand a distributed request traced via AWS CloudWatch logs.

Request id: ${detail.id}
Error count: ${detail.errorCount}, Warning count: ${detail.warningCount}, Operations: ${detail.opCount}

Timeline (JSON):
${timeline}

Relevant log lines (truncated):
${logs || "(no error/warning log lines in this window)"}

Infer root causes and fixes only from the data above. If the trace looks healthy, say so clearly in summaryLead and summary, and keep rootCause/suggestedFix short and practical (e.g. verification tips).

Respond with a single JSON object only (no markdown outside the JSON) with this exact shape:
{
  "summaryLead": "string — one short headline",
  "summary": "string — a few sentences",
  "rootCause": ["string", "..."],
  "suggestedFix": [{ "step": "string", "code": "optional shell snippet" }]
}`;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0.25 },
      messages: [
        {
          role: "system",
          content:
            "You output only valid JSON. Be concrete and reference service names and HTTP status codes when present. Do not invent log lines that were not implied by the input.",
        },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      t ? `Ollama error ${res.status}: ${t.slice(0, 200)}` : `Ollama error ${res.status}`,
    );
  }

  const data = (await res.json()) as {
    message?: { content?: string };
  };
  const raw = data.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("Ollama returned an empty response");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("Could not parse JSON from the model response");
  }

  return coerceAiInsight(parsed);
}
