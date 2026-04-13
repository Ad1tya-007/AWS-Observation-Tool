import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ActivityIcon,
  ChevronDownIcon,
  CommandIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  Settings2Icon,
  SparklesIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppUi } from '@/context/app-ui-context';
import { listAwsProfiles } from '@/lib/aws-api';
import { listInstalledModels, type OllamaModel } from '@/lib/ollama-api';
import { cn } from '@/lib/utils';

const PROFILE_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

export function TopBar() {
  const navigate = useNavigate();
  const {
    demoSsoExpired,
    activeProfile,
    setActiveProfile,
    selectedModel,
    setSelectedModel,
  } = useAppUi();

  const [profiles, setProfiles] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  const pathname = useLocation().pathname;

  useEffect(() => {
    listAwsProfiles()
      .then((ps) => {
        setProfiles(ps);
        if (ps.length > 0 && !ps.includes(activeProfile)) {
          setActiveProfile(ps[0]);
        }
      })
      .catch(() => {
        setProfiles(['default']);
      })
      .finally(() => setLoadingProfiles(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingModels(true);
    listInstalledModels()
      .then((ms) => {
        setModels(ms);
        if (ms.length > 0 && !ms.some((m) => m.name === selectedModel)) {
          setSelectedModel(ms[0]!.name);
        }
      })
      .catch(() => {
        setModels([]);
      })
      .finally(() => setLoadingModels(false));
  }, [selectedModel, setSelectedModel]);

  const connected = !demoSsoExpired;
  const profileDot =
    PROFILE_COLORS[profiles.indexOf(activeProfile) % PROFILE_COLORS.length] ??
    PROFILE_COLORS[0];

  function openCommandPalette() {
    document.dispatchEvent(new Event('observe:command-palette'));
  }

  return (
    <header
      className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm"
      role="banner">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500/20 to-violet-600/30 ring-1 ring-border/80">
            <ActivityIcon className="size-5 text-cyan-300" aria-hidden />
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold leading-none tracking-tight">
              Observe
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Local AI observability
            </span>
          </div>
        </div>

        <Separator orientation="vertical" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-border/80 bg-card/50 font-normal"
              aria-label={`AWS profile: ${activeProfile}. Open to switch profile.`}>
              {loadingProfiles ? (
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <span
                  className={cn('size-2 shrink-0 rounded-full', profileDot)}
                />
              )}
              <span className="max-w-32 truncate">{activeProfile}</span>
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              AWS profile
            </DropdownMenuLabel>
            {profiles.map((p, i) => (
              <DropdownMenuItem key={p} onClick={() => setActiveProfile(p)}>
                <span
                  className={cn(
                    'mr-2 size-2 rounded-full',
                    PROFILE_COLORS[i % PROFILE_COLORS.length],
                  )}
                />
                {p}
                {p === activeProfile && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    active
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <p className="px-2 pb-1 text-[10px] text-muted-foreground">
              Reads from ~/.aws — no keys stored in-app.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 gap-2 border-border/80 bg-card/40 px-2 font-mono text-[10px] sm:inline-flex"
          onClick={openCommandPalette}
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K"
          title="Search requests and navigate (⌘K or Ctrl+K)">
          <CommandIcon className="size-3.5" aria-hidden />
          <span className="max-[380px]:hidden">Search</span>
          <kbd className="pointer-events-none hidden rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </Button>

        <div className="hidden items-center gap-3 lg:flex">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-destructive/50 bg-destructive/10 text-destructive-foreground',
            )}>
            <span
              className={cn(
                'size-1.5 rounded-full',
                connected ? 'animate-pulse bg-emerald-400' : 'bg-destructive',
              )}
            />
            <span className="sr-only">AWS connection: </span>
            {connected ? 'Connected' : 'SSO expired'}
          </div>

          <div className="flex items-center gap-2">
            {loadingModels ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                <span>Loading models…</span>
              </div>
            ) : models.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Please install a model
              </span>
            ) : (
              <Select
                value={selectedModel}
                onValueChange={(value) => {
                  setSelectedModel(value);
                }}>
                <SelectTrigger
                  id="model"
                  size="sm"
                  className="h-8 w-[190px] border-border/80 bg-card/40 font-mono text-xs"
                  aria-label={`Ollama model: ${selectedModel}. Open to change model.`}>
                  <SparklesIcon className="size-3.5 text-violet-300" />
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem
                      key={m.name}
                      value={m.name}
                      className="font-mono text-xs">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {pathname === '/settings' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => navigate('/dashboard')}
            aria-label="Open dashboard"
            title="Dashboard">
            <LayoutDashboardIcon className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => navigate('/settings')}
            aria-label="Open settings"
            title="Settings">
            <Settings2Icon className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
