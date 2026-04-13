import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  ActivityIcon,
  ChevronDownIcon,
  CommandIcon,
  CopyIcon,
  Loader2Icon,
  MenuIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppUi } from "@/context/app-ui-context";
import { listAwsProfiles } from "@/lib/aws-api";
import { cn } from "@/lib/utils";

const PROFILE_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const models = ["mistral:latest", "llama3:latest", "codellama:latest"] as const;

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const {
    demoSsoExpired,
    setDemoSsoExpired,
    demoOllamaDown,
    setDemoOllamaDown,
    activeProfile,
    setActiveProfile,
  } = useAppUi();

  const [profiles, setProfiles] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    listAwsProfiles()
      .then((ps) => {
        setProfiles(ps);
        // Auto-select first profile if current default isn't in the real list
        if (ps.length > 0 && !ps.includes(activeProfile)) {
          setActiveProfile(ps[0]);
        }
      })
      .catch(() => {
        setProfiles(["default"]);
      })
      .finally(() => setLoadingProfiles(false));
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = !demoSsoExpired;
  const profileDot =
    PROFILE_COLORS[profiles.indexOf(activeProfile) % PROFILE_COLORS.length] ??
    PROFILE_COLORS[0];

  function openCommandPalette() {
    document.dispatchEvent(new Event("observe:command-palette"));
  }

  return (
    <header
      className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm"
      role="banner"
    >
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

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-border/80 bg-card/50 font-normal"
              aria-label={`AWS profile: ${activeProfile}. Open to switch profile.`}
            >
              {loadingProfiles ? (
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <span className={cn("size-2 shrink-0 rounded-full", profileDot)} />
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
                    "mr-2 size-2 rounded-full",
                    PROFILE_COLORS[i % PROFILE_COLORS.length],
                  )}
                />
                {p}
                {p === activeProfile && (
                  <span className="ml-auto text-[10px] text-muted-foreground">active</span>
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
          title="Search requests and navigate (⌘K or Ctrl+K)"
        >
          <CommandIcon className="size-3.5" aria-hidden />
          <span className="max-[380px]:hidden">Search</span>
          <kbd className="pointer-events-none hidden rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </Button>

        <div
          className={cn(
            "hidden items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium md:flex",
            connected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-destructive/50 bg-destructive/10 text-destructive-foreground",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected ? "animate-pulse bg-emerald-400" : "bg-destructive",
            )}
          />
          <span className="sr-only">AWS connection: </span>
          {connected ? "Connected" : "SSO expired"}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="model" className="sr-only">
            Ollama model
          </Label>
          <Select defaultValue={models[0]}>
            <SelectTrigger
              id="model"
              size="sm"
              className="h-8 w-[140px] border-border/80 bg-card/40 font-mono text-xs"
            >
              <SparklesIcon className="size-3.5 text-violet-300" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m} className="font-mono text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 shrink-0">
              <MenuIcon className="size-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <SunIcon className="mr-2 size-4" />
              Light{theme === "light" ? " · active" : ""}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <MoonIcon className="mr-2 size-4" />
              Dark{theme === "dark" ? " · active" : ""}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Debug / demo
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={demoSsoExpired}
              onCheckedChange={(v) => setDemoSsoExpired(Boolean(v))}
            >
              Simulate SSO expired
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={demoOllamaDown}
              onCheckedChange={(v) => setDemoOllamaDown(Boolean(v))}
            >
              Simulate Ollama offline
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText("aws sso login");
                toast.success("Copied aws sso login");
              }}
            >
              <CopyIcon className="mr-2 size-4" />
              Copy <code className="mx-1 font-mono text-[10px]">aws sso login</code>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
