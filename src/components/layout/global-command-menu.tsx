import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppUi } from "@/context/app-ui-context";
import { LayoutDashboardIcon, RouteIcon } from "lucide-react";

export function GlobalCommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { lastFetchedRequests } = useAppUi();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("observe:command-palette", onOpenEvent as EventListener);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("observe:command-palette", onOpenEvent as EventListener);
    };
  }, []);

  const go = useCallback(
    (to: string) => {
      navigate(to);
      setOpen(false);
    },
    [navigate],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
      <Command className="rounded-xl">
        <CommandInput placeholder="Search requests, navigate…" aria-label="Command palette search" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem value="dashboard home requests" onSelect={() => go("/")}>
              <LayoutDashboardIcon />
              Requests dashboard
            </CommandItem>
          </CommandGroup>
          {lastFetchedRequests.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Open request trace">
                {lastFetchedRequests.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`${row.id} ${row.errorCount} errors ${row.warningCount} warnings ${row.servicesTouched} services`}
                    onSelect={() => go(`/requests/${encodeURIComponent(row.id)}`)}
                  >
                    <RouteIcon />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs">{row.id}</span>
                      <span className="ml-2 text-muted-foreground">
                        {row.servicesTouched} svc · {row.errorCount} err · {row.warningCount} warn
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
