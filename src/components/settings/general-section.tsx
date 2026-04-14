import { useTheme } from 'next-themes';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export function GeneralSection() {
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
