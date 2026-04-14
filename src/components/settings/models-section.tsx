import { useCallback, useEffect, useState } from 'react';
import {
  CheckIcon,
  ChevronRightIcon,
  CpuIcon,
  DownloadIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  WifiOffIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useAppUi } from '@/context/app-ui-context';
import {
  checkOllamaRunning,
  deleteModel,
  formatModelSize,
  listInstalledModels,
  pullModel,
  type OllamaModel,
} from '@/lib/ollama-api';
import { cn } from '@/lib/utils';
import { POPULAR_MODELS } from './constants';

interface PullState {
  status: string;
  percent?: number;
  done?: boolean;
  error?: string;
}

export function ModelsSection() {
  const { selectedModel, demoOllamaDown } = useAppUi();

  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [pullStates, setPullStates] = useState<Record<string, PullState>>({});

  const refresh = useCallback(async () => {
    setLoadingModels(true);
    const running = demoOllamaDown ? false : await checkOllamaRunning();
    setOllamaRunning(running);
    if (running) {
      try {
        const models = await listInstalledModels();
        setInstalledModels(models);
      } catch {
        setInstalledModels([]);
      }
    } else {
      setInstalledModels([]);
    }
    setLoadingModels(false);
  }, [demoOllamaDown]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(name: string) {
    setDeletingModel(name);
    try {
      await deleteModel(name);
      toast.success(`Removed ${name}`);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to remove model',
      );
    } finally {
      setDeletingModel(null);
    }
  }

  async function handlePull(name: string) {
    setPullStates((prev) => ({ ...prev, [name]: { status: 'Starting…' } }));
    try {
      await pullModel(name, (progress) => {
        setPullStates((prev) => ({
          ...prev,
          [name]: { status: progress.status, percent: progress.percent },
        }));
      });
      setPullStates((prev) => ({
        ...prev,
        [name]: { status: 'Complete', percent: 100, done: true },
      }));
      toast.success(`Pulled ${name}`);
      await refresh();
      setTimeout(() => {
        setPullStates((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pull failed';
      setPullStates((prev) => ({
        ...prev,
        [name]: { status: 'Failed', error: message },
      }));
      toast.error(message);
    }
  }

  const installedNames = new Set(
    installedModels.flatMap((m) => [m.name, m.name.split(':')[0]]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Models</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage Ollama and the AI models available for analysis.
        </p>
      </div>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Ollama</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Local inference runtime for AI models.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refresh()}
            disabled={loadingModels}
            className="h-8 gap-1.5 text-xs">
            <RefreshCwIcon
              className={cn('size-3.5', loadingModels && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>

        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border p-4',
            ollamaRunning === null
              ? 'border-border/60 bg-card/30'
              : ollamaRunning
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-destructive/30 bg-destructive/5',
          )}>
          {ollamaRunning === null ? (
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          ) : ollamaRunning ? (
            <span className="relative flex size-5 items-center justify-center">
              <span className="absolute size-3 animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="size-2.5 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <WifiOffIcon className="size-5 text-destructive" />
          )}

          <div className="flex-1">
            <p className="text-sm font-medium">
              {ollamaRunning === null
                ? 'Checking…'
                : ollamaRunning
                  ? 'Running'
                  : 'Not detected'}
            </p>
            <p className="text-xs text-muted-foreground">
              {ollamaRunning === null
                ? 'Connecting to localhost:11434'
                : ollamaRunning
                  ? `localhost:11434 · ${installedModels.length} model${installedModels.length !== 1 ? 's' : ''} installed`
                  : 'Ollama is not running or not installed'}
            </p>
          </div>

          {!ollamaRunning && ollamaRunning !== null && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              asChild>
              <a href="https://ollama.ai" target="_blank" rel="noreferrer">
                Install Ollama
                <ChevronRightIcon className="size-3" />
              </a>
            </Button>
          )}
        </div>
      </section>

      {ollamaRunning && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Installed Models</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Models available for AI analysis.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Currently using:{' '}
              <span className="font-mono text-[11px] text-foreground">
                {selectedModel || 'mistral:latest'}
              </span>
            </p>
          </div>

          {loadingModels ? (
            <div className="flex h-20 items-center justify-center text-muted-foreground">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              <span className="text-sm">Loading models…</span>
            </div>
          ) : installedModels.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 px-6 py-8 text-center">
              <CpuIcon className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No models installed yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Pull a model from the list below to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              {installedModels.map((model) => {
                const isActive =
                  selectedModel === model.name ||
                  selectedModel === `${model.name.split(':')[0]}:latest`;
                return (
                  <div
                    key={model.name}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                    <SparklesIcon
                      className={cn(
                        'size-4 shrink-0',
                        isActive
                          ? 'text-violet-400'
                          : 'text-muted-foreground/50',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm">
                          {model.name}
                        </span>
                        {isActive && (
                          <Badge
                            variant="secondary"
                            className="h-4 shrink-0 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300">
                            active
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {model.details?.parameter_size && (
                          <span>{model.details.parameter_size}</span>
                        )}
                        {model.size > 0 && (
                          <>
                            {model.details?.parameter_size && <span>·</span>}
                            <span>{formatModelSize(model.size)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={deletingModel === model.name}
                        onClick={() => void handleDelete(model.name)}
                        aria-label={`Remove ${model.name}`}>
                        {deletingModel === model.name ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {ollamaRunning && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Available Models</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Popular models you can pull from the Ollama library.
            </p>
          </div>

          <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
            {POPULAR_MODELS.map((model) => {
              const isInstalled = installedNames.has(model.name);
              const pullState = pullStates[model.name];
              const isPulling =
                pullState && !pullState.done && !pullState.error;

              return (
                <div
                  key={model.name}
                  className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{model.label}</span>
                      <Badge
                        variant="outline"
                        className="h-4 shrink-0 text-[10px]">
                        {model.tag}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="h-4 shrink-0 text-[10px]">
                        {model.size}
                      </Badge>
                      {isInstalled && (
                        <Badge
                          variant="secondary"
                          className="h-4 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
                          installed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {model.description}
                    </p>
                    {isPulling && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {pullState.status}
                          </span>
                          {pullState.percent !== undefined && (
                            <span className="text-[11px] text-muted-foreground">
                              {pullState.percent}%
                            </span>
                          )}
                        </div>
                        <Progress
                          value={pullState.percent ?? 0}
                          className="h-1"
                        />
                      </div>
                    )}
                    {pullState?.done && (
                      <p className="mt-1 text-[11px] text-emerald-400">
                        ✓ Pulled successfully
                      </p>
                    )}
                    {pullState?.error && (
                      <p className="mt-1 text-[11px] text-destructive">
                        {pullState.error}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={isInstalled ? 'ghost' : 'outline'}
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 text-xs"
                    disabled={isInstalled || Boolean(isPulling)}
                    onClick={() => void handlePull(model.name)}
                    aria-label={`Pull ${model.label}`}>
                    {isPulling ? (
                      <>
                        <Loader2Icon className="size-3 animate-spin" />
                        Pulling…
                      </>
                    ) : isInstalled ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-400" />
                        Installed
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="size-3" />
                        Pull
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
