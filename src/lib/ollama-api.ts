const OLLAMA_BASE = "http://localhost:11434";

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
