import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  CheckIcon,
  ChevronRightIcon,
  CpuIcon,
  DownloadIcon,
  type LucideIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SunIcon,
  Trash2Icon,
  WifiOffIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

type SettingsSection = 'general' | 'models';

const POPULAR_MODELS = [
  {
    name: 'mistral',
    label: 'Mistral 7B',
    description: 'Fast, versatile 7B model by Mistral AI',
    tag: 'Popular',
    size: '4.1GB',
  },
  {
    name: 'llama3.2',
    label: 'Llama 3.2 3B',
    description: "Meta's lightweight 3B model",
    tag: 'Compact',
    size: '2.5GB',
  },
  {
    name: 'llama3.1',
    label: 'Llama 3.1 8B',
    description: "Meta's capable 8B instruction model",
    tag: 'Popular',
    size: '8.1GB',
  },
  {
    name: 'codellama',
    label: 'Code Llama 7B',
    description: 'Specialized for code generation',
    tag: 'Code',
    size: '4.3GB',
  },
  {
    name: 'phi3',
    label: 'Phi-3 Mini',
    description: "Microsoft's efficient 3.8B model",
    tag: 'Compact',
    size: '2.7GB',
  },
  {
    name: 'gemma2',
    label: 'Gemma 2 2B',
    description: "Google's lightweight open model",
    tag: 'Compact',
    size: '1.4GB',
  },
  {
    name: 'qwen2.5-coder',
    label: 'Qwen 2.5 Coder',
    description: "Alibaba's code-focused model",
    tag: 'Code',
    size: '7.5GB',
  },
  {
    name: 'deepseek-r1',
    label: 'DeepSeek R1',
    description: 'Strong reasoning and analysis',
    tag: 'Reasoning',
    size: '8.7GB',
  },
] as const;

// ─── General Section ──────────────────────────────────────────────────────────

function GeneralSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">General</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your application preferences.
        </p>
      </div>

      <Separator />

      {/* Appearance */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Appearance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose how the application looks on your device.
          </p>
        </div>

        <div className="flex items-start gap-6">
          <ToggleGroup
            type="single"
            value={theme ?? 'system'}
            onValueChange={(v) => {
              if (v) setTheme(v);
            }}
            variant="outline"
            className="gap-0">
            <ToggleGroupItem
              value="light"
              className="gap-2 px-4 py-2 text-sm"
              aria-label="Light theme">
              <SunIcon className="size-4" />
              Light
            </ToggleGroupItem>
            <ToggleGroupItem
              value="dark"
              className="gap-2 px-4 py-2 text-sm"
              aria-label="Dark theme">
              <MoonIcon className="size-4" />
              Dark
            </ToggleGroupItem>
            <ToggleGroupItem
              value="system"
              className="gap-2 px-4 py-2 text-sm"
              aria-label="System theme">
              <MonitorIcon className="size-4" />
              System
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Theme preview cards */}
        <div className="flex gap-3">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'group relative flex-1 cursor-pointer overflow-hidden rounded-lg border-2 transition-all',
                (theme ?? 'system') === t
                  ? 'border-primary shadow-sm shadow-primary/20'
                  : 'border-border/60 hover:border-border',
              )}
              aria-label={`Switch to ${t} theme`}>
              {/* Mini app preview */}
              {t === 'light' && (
                <div className="h-20 bg-white">
                  <div className="h-5 border-b border-neutral-200 bg-neutral-50" />
                  <div className="m-2 space-y-1.5">
                    <div className="h-1.5 w-3/4 rounded-full bg-neutral-200" />
                    <div className="h-1.5 w-1/2 rounded-full bg-neutral-200" />
                  </div>
                </div>
              )}
              {t === 'dark' && (
                <div className="h-20 bg-neutral-950">
                  <div className="h-5 border-b border-neutral-800 bg-neutral-900" />
                  <div className="m-2 space-y-1.5">
                    <div className="h-1.5 w-3/4 rounded-full bg-neutral-700" />
                    <div className="h-1.5 w-1/2 rounded-full bg-neutral-700" />
                  </div>
                </div>
              )}
              {t === 'system' && (
                <div className="flex h-20 overflow-hidden">
                  <div className="w-1/2 bg-white">
                    <div className="h-5 border-b border-neutral-200 bg-neutral-50" />
                    <div className="m-2 space-y-1.5">
                      <div className="h-1.5 w-3/4 rounded-full bg-neutral-200" />
                    </div>
                  </div>
                  <div className="w-1/2 bg-neutral-950">
                    <div className="h-5 border-b border-neutral-800 bg-neutral-900" />
                    <div className="m-2 space-y-1.5">
                      <div className="h-1.5 w-3/4 rounded-full bg-neutral-700" />
                    </div>
                  </div>
                </div>
              )}
              {/* Active checkmark */}
              {(theme ?? 'system') === t && (
                <div className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
                  <CheckIcon className="size-2.5 text-primary-foreground" />
                </div>
              )}
              <p className="border-t border-border/60 bg-card/60 px-2 py-1.5 text-center text-[11px] capitalize text-muted-foreground">
                {t}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Models Section ───────────────────────────────────────────────────────────

interface PullState {
  status: string;
  percent?: number;
  done?: boolean;
  error?: string;
}

function ModelsSection() {
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

      {/* Ollama Status */}
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

      {/* Installed Models */}
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

      {/* Available Models */}
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

// ─── Settings Page ─────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('general');

  const navItems: {
    id: SettingsSection;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: 'general', label: 'General', icon: SlidersHorizontalIcon },
    { id: 'models', label: 'Models', icon: CpuIcon },
  ];

  return (
    <div className="flex h-full bg-background">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border/60 bg-card/20">
        {/* Nav */}
        <nav className="flex-1 px-2 pb-4">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                activeSection === id
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}>
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        {activeSection === 'general' ? <GeneralSection /> : <ModelsSection />}
      </ScrollArea>
    </div>
  );
}
