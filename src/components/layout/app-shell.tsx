import { GlobalCommandMenu } from "@/components/layout/global-command-menu";
import { TopBar } from "@/components/layout/top-bar";
import { SkipToMainLink } from "@/components/accessibility/skip-link";
import { AppUiProvider } from "@/context/app-ui-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppUiProvider>
      <div className="relative flex h-svh min-h-0 flex-col bg-background">
        <SkipToMainLink />
        <TopBar />
        <GlobalCommandMenu />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Application content"
        >
          {children}
        </main>
      </div>
    </AppUiProvider>
  );
}
