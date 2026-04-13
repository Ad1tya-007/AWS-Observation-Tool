import { invoke } from "@tauri-apps/api/core";

// ─── Log group ────────────────────────────────────────────────────────────────

export interface AwsLogGroup {
  /** Same as `name` – the full CloudWatch log group path, e.g. `/ecs/prod/user-api`. */
  id: string;
  name: string;
  region: string;
  cluster: string;
  service: string;
}

// ─── Dashboard list types ─────────────────────────────────────────────────────

export interface StripSegment {
  type: "error" | "warning" | "success";
  ratio: number;
}

export interface ObservedRequest {
  id: string;
  errorCount: number;
  warningCount: number;
  opCount: number;
  servicesTouched: number;
  lastSeen: string;
  segments: StripSegment[];
}

// ─── Request detail types ─────────────────────────────────────────────────────

export type OpState = "error" | "warning" | "success";
export type OpKind = "http" | "db" | "queue";

export interface TimelineOp {
  id: string;
  service: string;
  endpoint: string;
  latencyMs?: number;
  httpStatus?: number;
  state: OpState;
  kind: OpKind;
}

export interface LogLine {
  id: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  text: string;
  opId?: string;
}

export interface SuggestedFix {
  step: string;
  code?: string;
}

export interface AiInsight {
  summaryLead: string;
  summary: string;
  rootCause: string[];
  suggestedFix: SuggestedFix[];
  confidence: number;
  confidenceLabel: "High" | "Medium" | "Low";
}

export interface RequestDetail {
  id: string;
  errorCount: number;
  warningCount: number;
  opCount: number;
  lastSeen: string;
  segments: StripSegment[];
  timeline: TimelineOp[];
  logs: LogLine[];
  ai: AiInsight;
}

// ─── Fetch params (shared between dashboard + detail page) ───────────────────

export interface FetchParams {
  logGroupNames: string[];
  startTimeMs: number;
  endTimeMs: number;
  profile: string;
  region: string;
}

// ─── Invoke wrappers ──────────────────────────────────────────────────────────

/** Returns all AWS profile names from ~/.aws/config and ~/.aws/credentials. */
export function listAwsProfiles(): Promise<string[]> {
  return invoke<string[]>("list_aws_profiles");
}

/**
 * List CloudWatch log groups for the given profile + region.
 * Throws a string beginning with "SessionExpired:" when credentials have expired.
 */
export function listLogGroups(params: {
  profile?: string;
  region?: string;
}): Promise<AwsLogGroup[]> {
  return invoke<AwsLogGroup[]>("list_log_groups", params);
}

/**
 * Fetch and correlate log events from the selected log groups.
 * `logGroupNames` should be the full CloudWatch log group names (i.e. the `id` field).
 * Throws a string beginning with "SessionExpired:" when credentials have expired.
 */
export function fetchObservedRequests(params: {
  logGroupNames: string[];
  startTimeMs: number;
  endTimeMs: number;
  profile?: string;
  region?: string;
}): Promise<ObservedRequest[]> {
  return invoke<ObservedRequest[]>("fetch_observed_requests", params);
}

/**
 * Fetch the full detail (timeline, logs, rule-based AI insight) for a single request.
 * Returns `null` when no events are found for the given ID.
 */
export function fetchRequestDetail(params: {
  requestId: string;
  logGroupNames: string[];
  startTimeMs: number;
  endTimeMs: number;
  profile?: string;
  region?: string;
}): Promise<RequestDetail | null> {
  return invoke<RequestDetail | null>("fetch_request_detail", params);
}
