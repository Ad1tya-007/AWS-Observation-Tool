import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { FetchParams, ObservedRequest } from "@/lib/aws-api";

export type AppUiContextValue = {
  // AWS connection / demo flags
  demoSsoExpired: boolean;
  setDemoSsoExpired: (v: boolean) => void;
  demoOllamaDown: boolean;
  setDemoOllamaDown: (v: boolean) => void;

  // Active AWS profile + region (shared between TopBar and all data-fetching pages)
  activeProfile: string;
  setActiveProfile: (v: string) => void;
  activeRegion: string;
  setActiveRegion: (v: string) => void;

  /** The currently selected Ollama model used for AI insights. */
  selectedModel: string;
  setSelectedModel: (v: string) => void;

  /**
   * Parameters from the most recent dashboard "Fetch / Refresh" call.
   * The detail page uses these to know which log groups and time window to
   * re-query when loading a specific request trace.
   */
  lastFetchParams: FetchParams | null;
  setLastFetchParams: (params: FetchParams | null) => void;

  /** The request rows returned by the last dashboard fetch (used by the command palette). */
  lastFetchedRequests: ObservedRequest[];
  setLastFetchedRequests: (rows: ObservedRequest[]) => void;
};

const AppUiContext = createContext<AppUiContextValue | null>(null);

export function AppUiProvider({ children }: { children: ReactNode }) {
  const [demoSsoExpired, setDemoSsoExpired] = useState(false);
  const [demoOllamaDown, setDemoOllamaDown] = useState(false);
  const [activeProfile, setActiveProfile] = useState("default");
  const [activeRegion, setActiveRegion] = useState("us-east-1");
  const [selectedModel, setSelectedModel] = useState("mistral:latest");
  const [lastFetchParams, setLastFetchParams] = useState<FetchParams | null>(null);
  const [lastFetchedRequests, setLastFetchedRequests] = useState<ObservedRequest[]>([]);

  const value = useMemo(
    () => ({
      demoSsoExpired,
      setDemoSsoExpired,
      demoOllamaDown,
      setDemoOllamaDown,
      activeProfile,
      setActiveProfile,
      activeRegion,
      setActiveRegion,
      selectedModel,
      setSelectedModel,
      lastFetchParams,
      setLastFetchParams,
      lastFetchedRequests,
      setLastFetchedRequests,
    }),
    [demoSsoExpired, demoOllamaDown, activeProfile, activeRegion, selectedModel, lastFetchParams, lastFetchedRequests],
  );

  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
  const ctx = useContext(AppUiContext);
  if (!ctx) {
    throw new Error("useAppUi must be used within AppUiProvider");
  }
  return ctx;
}
