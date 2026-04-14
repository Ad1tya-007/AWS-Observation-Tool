use aws_config::BehaviorVersion;
use aws_sdk_cloudwatchlogs::{config::Region, Client};
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

// ─── Serialisable types sent to the frontend ────────────────────────────────

/// A real CloudWatch log group.  `id` == `name` so the JS picker can use either.
#[derive(Debug, Serialize, Clone)]
pub struct AwsLogGroup {
    pub id: String,
    pub name: String,
    pub region: String,
    pub cluster: String,
    pub service: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StripSegment {
    #[serde(rename = "type")]
    pub seg_type: String,
    pub ratio: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ObservedRequest {
    pub id: String,
    pub error_count: u32,
    pub warning_count: u32,
    pub op_count: u32,
    pub services_touched: u32,
    pub last_seen: String,
    pub segments: Vec<StripSegment>,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| String::from("/"))
}

fn is_session_expired(msg: &str) -> bool {
    msg.contains("ExpiredToken")
        || msg.contains("InvalidClientTokenId")
        || msg.contains("ExpiredTokenException")
        || msg.contains("TokenExpiredException")
        || msg.contains("AuthFailure")
}

/// Derive (cluster, service) from a CloudWatch log group path.
/// Understands: `/ecs/<cluster>/<svc>`, `/aws/ecs/<cluster>/<svc>`, any arbitrary prefix.
fn parse_log_group_path(name: &str) -> (String, String) {
    let stripped = name.trim_start_matches('/');
    let parts: Vec<&str> = stripped.split('/').collect();
    match parts.as_slice() {
        ["ecs", cluster, service] => (cluster.to_string(), service.to_string()),
        [_, "ecs", cluster, service] => (cluster.to_string(), service.to_string()),
        _ => {
            let service = parts.last().copied().unwrap_or(name).to_string();
            let cluster = if parts.len() >= 2 {
                parts[parts.len() - 2].to_string()
            } else {
                "default".to_string()
            };
            (cluster, service)
        }
    }
}

/// Try to extract a stable request/trace correlation ID from a log message.
/// Tries JSON fields, Lambda-style headers, and tab-delimited ECS formats.
fn extract_request_id(message: &str) -> Option<String> {
    let trimmed = message.trim();

    // JSON structured logs
    if trimmed.starts_with('{') {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            for key in &[
                "requestId",
                "request_id",
                "traceId",
                "trace_id",
                "correlationId",
                "correlation_id",
                "x-request-id",
                "X-Request-ID",
                "requestid",
            ] {
                if let Some(v) = val.get(key).and_then(|v| v.as_str()) {
                    if v.len() >= 8 {
                        return Some(v.to_string());
                    }
                }
            }
        }
    }

    // Lambda: "START RequestId: <uuid> Version: $LATEST"
    if let Some(rest) = trimmed.strip_prefix("START RequestId: ") {
        if let Some(id) = rest.split_whitespace().next() {
            if id.len() >= 8 {
                return Some(id.to_string());
            }
        }
    }

    // Inline "RequestId: <id>"
    if let Some(pos) = message.find("RequestId: ") {
        let after = &message[pos + 11..];
        let id: String = after
            .chars()
            .take_while(|&c| c.is_ascii_alphanumeric() || c == '-')
            .collect();
        if id.len() >= 8 {
            return Some(id);
        }
    }

    // Tab-delimited ECS format: "timestamp\t<req-id>\tLEVEL\tmessage"
    let tabs: Vec<&str> = trimmed.splitn(4, '\t').collect();
    if tabs.len() >= 2 {
        let candidate = tabs[1].trim();
        if is_valid_id(candidate) {
            return Some(candidate.to_string());
        }
    }

    None
}

fn is_valid_id(s: &str) -> bool {
    s.len() >= 8
        && s.len() <= 128
        && s.contains('-')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Classify a log line as "error", "warning", or "success".
fn classify_message(message: &str) -> &'static str {
    let m = message.to_lowercase();

    let is_error = m.contains("\"level\":\"error\"")
        || m.contains("\"level\": \"error\"")
        || m.contains("\terror\t")
        || m.contains("[error]")
        || m.contains(" error:")
        || m.contains("exception")
        || m.contains("traceback")
        || m.contains("fatal")
        || m.contains(" 500 ")
        || m.contains("\" 500\"")
        || m.contains(" 502 ")
        || m.contains(" 503 ")
        || m.contains(" 504 ")
        || m.contains("http 5");

    if is_error {
        return "error";
    }

    let is_warn = m.contains("\"level\":\"warn\"")
        || m.contains("\"level\": \"warn\"")
        || m.contains("\twarn\t")
        || m.contains("[warn]")
        || m.contains(" warn:")
        || m.contains("slow")
        || m.contains("timeout")
        || m.contains("retry")
        || m.contains("deprecated")
        || m.contains("circuit");

    if is_warn {
        "warning"
    } else {
        "success"
    }
}

// ─── Per-group event fetching ────────────────────────────────────────────────

struct RawEvent {
    service: String,
    timestamp_ms: i64,
    message: String,
}

/// Fetch log events from a single CloudWatch log group.
/// Reads up to 3 pages (≤ 3 000 events) to stay within API quotas.
async fn fetch_events_for_group(
    client: &Client,
    group_name: &str,
    start_time_ms: i64,
    end_time_ms: i64,
) -> Vec<RawEvent> {
    let (_, service) = parse_log_group_path(group_name);
    let mut events = Vec::new();
    let mut next_token: Option<String> = None;
    let mut pages = 0usize;

    loop {
        let mut req = client
            .filter_log_events()
            .log_group_name(group_name)
            .start_time(start_time_ms)
            .end_time(end_time_ms)
            .limit(1000);

        if let Some(ref t) = next_token {
            req = req.next_token(t);
        }

        match req.send().await {
            Ok(resp) => {
                for event in resp.events() {
                    if let (Some(msg), Some(ts)) = (event.message(), event.timestamp()) {
                        events.push(RawEvent {
                            service: service.clone(),
                            timestamp_ms: ts,
                            message: msg.to_string(),
                        });
                    }
                }
                next_token = resp.next_token().map(|s| s.to_string());
                pages += 1;
                if next_token.is_none() || pages >= 3 || events.len() >= 3_000 {
                    break;
                }
            }
            Err(_) => break, // log group inaccessible – skip silently
        }
    }

    events
}

// ─── Request correlation ─────────────────────────────────────────────────────

fn build_observed_request(id: String, events: &[RawEvent]) -> ObservedRequest {
    let mut error_count = 0u32;
    let mut warning_count = 0u32;
    let mut services: HashSet<String> = HashSet::new();
    let mut last_seen_ms = 0i64;

    for event in events {
        services.insert(event.service.clone());
        if event.timestamp_ms > last_seen_ms {
            last_seen_ms = event.timestamp_ms;
        }
        match classify_message(&event.message) {
            "error" => error_count += 1,
            "warning" => warning_count += 1,
            _ => {}
        }
    }

    let op_count = events.len() as u32;
    let services_touched = services.len() as u32;
    let success_count = op_count.saturating_sub(error_count + warning_count);
    let total = op_count as f64;

    let segments = if total == 0.0 {
        vec![StripSegment {
            seg_type: "success".to_string(),
            ratio: 1.0,
        }]
    } else {
        let mut segs = Vec::new();
        if error_count > 0 {
            segs.push(StripSegment {
                seg_type: "error".to_string(),
                ratio: error_count as f64 / total,
            });
        }
        if warning_count > 0 {
            segs.push(StripSegment {
                seg_type: "warning".to_string(),
                ratio: warning_count as f64 / total,
            });
        }
        if success_count > 0 {
            segs.push(StripSegment {
                seg_type: "success".to_string(),
                ratio: success_count as f64 / total,
            });
        }
        segs
    };

    let last_seen = DateTime::from_timestamp_millis(last_seen_ms)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();

    ObservedRequest {
        id,
        error_count,
        warning_count,
        op_count,
        services_touched,
        last_seen,
        segments,
    }
}

// ─── AWS client factory ───────────────────────────────────────────────────────

async fn make_client(profile: Option<&str>, region: &str) -> Client {
    let mut loader =
        aws_config::defaults(BehaviorVersion::latest()).region(Region::new(region.to_string()));
    if let Some(p) = profile {
        loader = loader.profile_name(p);
    }
    let config = loader.load().await;
    Client::new(&config)
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

/// Return all AWS profile names found in ~/.aws/config and ~/.aws/credentials.
#[tauri::command]
fn list_aws_profiles() -> Vec<String> {
    let home = home_dir();
    let mut profiles: Vec<String> = Vec::new();

    let config_path = format!("{}/.aws/config", home);
    if let Ok(content) = std::fs::read_to_string(&config_path) {
        for line in content.lines() {
            let line = line.trim();
            if line == "[default]" {
                if !profiles.contains(&"default".to_string()) {
                    profiles.push("default".to_string());
                }
            } else if line.starts_with("[profile ") && line.ends_with(']') {
                let name = line[9..line.len() - 1].trim().to_string();
                if !name.is_empty() && !profiles.contains(&name) {
                    profiles.push(name);
                }
            }
        }
    }

    let creds_path = format!("{}/.aws/credentials", home);
    if let Ok(content) = std::fs::read_to_string(&creds_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with('[') && line.ends_with(']') {
                let name = line[1..line.len() - 1].trim().to_string();
                if !name.is_empty() && !profiles.contains(&name) {
                    profiles.push(name);
                }
            }
        }
    }

    if profiles.is_empty() {
        profiles.push("default".to_string());
    }

    profiles
}

/// List CloudWatch log groups (up to 500) for the given profile + region.
/// Returns `Err("SessionExpired: …")` when credentials have expired.
#[tauri::command]
async fn list_log_groups(
    profile: Option<String>,
    region: Option<String>,
) -> Result<Vec<AwsLogGroup>, String> {
    let region_str = region.unwrap_or_else(|| "us-east-1".to_string());
    let client = make_client(profile.as_deref(), &region_str).await;

    let mut groups: Vec<AwsLogGroup> = Vec::new();
    let mut next_token: Option<String> = None;

    loop {
        let mut req = client.describe_log_groups().limit(50);
        if let Some(ref t) = next_token {
            req = req.next_token(t);
        }

        match req.send().await {
            Ok(resp) => {
                for lg in resp.log_groups() {
                    if let Some(name) = lg.log_group_name() {
                        let (cluster, service) = parse_log_group_path(name);
                        groups.push(AwsLogGroup {
                            id: name.to_string(),
                            name: name.to_string(),
                            region: region_str.clone(),
                            cluster,
                            service,
                        });
                    }
                }
                next_token = resp.next_token().map(|s| s.to_string());
                if next_token.is_none() || groups.len() >= 500 {
                    break;
                }
            }
            Err(e) => {
                let msg = e.to_string();
                return Err(if is_session_expired(&msg) {
                    "SessionExpired: AWS session has expired. Run `aws sso login`.".to_string()
                } else {
                    format!("AWS error: {msg}")
                });
            }
        }
    }

    Ok(groups)
}

/// Fetch log events from the selected log groups, correlate by requestId,
/// and return a list of `ObservedRequest` summaries for the dashboard table.
#[tauri::command]
async fn fetch_observed_requests(
    log_group_names: Vec<String>,
    start_time_ms: i64,
    end_time_ms: i64,
    profile: Option<String>,
    region: Option<String>,
) -> Result<Vec<ObservedRequest>, String> {
    if log_group_names.is_empty() {
        return Ok(vec![]);
    }

    let region_str = region.unwrap_or_else(|| "us-east-1".to_string());
    let client = make_client(profile.as_deref(), &region_str).await;

    // Fetch up to 30 log groups in parallel
    let mut join_set = tokio::task::JoinSet::new();
    for group_name in log_group_names.into_iter().take(30) {
        let client = client.clone();
        let start = start_time_ms;
        let end = end_time_ms;
        join_set.spawn(async move {
            fetch_events_for_group(&client, &group_name, start, end).await
        });
    }

    let mut all_events: Vec<RawEvent> = Vec::new();
    while let Some(result) = join_set.join_next().await {
        if let Ok(events) = result {
            all_events.extend(events);
        }
    }

    // Group events by extracted request ID; fall back to (service, 5-min window) buckets
    let mut grouped: HashMap<String, Vec<RawEvent>> = HashMap::new();
    for event in all_events {
        let req_id = extract_request_id(&event.message).unwrap_or_else(|| {
            let window = event.timestamp_ms / (5 * 60 * 1_000);
            format!("{}#{}", event.service, window)
        });
        grouped.entry(req_id).or_default().push(event);
    }

    let mut requests: Vec<ObservedRequest> = grouped
        .into_iter()
        .map(|(id, events)| build_observed_request(id, &events))
        .collect();

    // Most-recent first; cap at 200 rows
    requests.sort_by(|a, b| b.last_seen.cmp(&a.last_seen));
    requests.truncate(200);

    Ok(requests)
}

// ─── Request detail types ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimelineOp {
    pub id: String,
    pub service: String,
    pub endpoint: String,
    pub latency_ms: Option<i64>,
    pub http_status: Option<i32>,
    /// "error" | "warning" | "success"
    pub state: String,
    /// "http" | "db" | "queue"
    pub kind: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub id: String,
    /// "ERROR" | "WARN" | "INFO" | "DEBUG"
    pub level: String,
    pub text: String,
    pub op_id: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SuggestedFix {
    pub step: String,
    pub code: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiInsight {
    pub summary_lead: String,
    pub summary: String,
    pub root_cause: Vec<String>,
    pub suggested_fix: Vec<SuggestedFix>,
    pub confidence: f64,
    pub confidence_label: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RequestDetail {
    pub id: String,
    pub error_count: u32,
    pub warning_count: u32,
    pub op_count: u32,
    pub last_seen: String,
    pub segments: Vec<StripSegment>,
    pub timeline: Vec<TimelineOp>,
    pub logs: Vec<LogLine>,
    pub ai: AiInsight,
}

// ─── Detail helpers ───────────────────────────────────────────────────────────

/// Try to extract an HTTP endpoint string and optional status code from a log message.
fn extract_http_info(message: &str) -> Option<(String, Option<i32>)> {
    let trimmed = message.trim();
    // JSON structured log
    if trimmed.starts_with('{') {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            let method = val
                .get("method")
                .or_else(|| val.get("httpMethod"))
                .and_then(|v| v.as_str());
            let path = val
                .get("path")
                .or_else(|| val.get("url"))
                .or_else(|| val.get("endpoint"))
                .or_else(|| val.get("uri"))
                .and_then(|v| v.as_str());
            let status = val
                .get("status")
                .or_else(|| val.get("statusCode"))
                .or_else(|| val.get("http_status"))
                .and_then(|v| v.as_i64())
                .map(|s| s as i32);
            if let Some(path) = path {
                let ep = match method {
                    Some(m) => format!("{} {}", m, path),
                    None => path.to_string(),
                };
                return Some((ep, status));
            }
        }
    }

    // Textual "METHOD /path" pattern
    for method in &["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] {
        if let Some(pos) = message.find(method) {
            let before = &message[..pos];
            if !before.is_empty()
                && before
                    .chars()
                    .last()
                    .map_or(false, |c| c.is_ascii_alphanumeric())
            {
                continue; // part of another word
            }
            let after = &message[pos + method.len()..];
            let rest = after.trim_start_matches([' ', '\t']);
            if rest.starts_with('/') {
                let path: String = rest
                    .chars()
                    .take_while(|&c| !matches!(c, ' ' | '\t' | '\n' | '"'))
                    .collect();
                let tail = &rest[path.len()..];
                let status = tail
                    .split_whitespace()
                    .find_map(|w| w.parse::<i32>().ok().filter(|&s| (100..=599).contains(&s)));
                return Some((format!("{} {}", method, path), status));
            }
        }
    }

    None
}

fn detect_op_kind(service: &str) -> &'static str {
    let s = service.to_lowercase();
    if s.contains("db")
        || s.contains("sql")
        || s.contains("mongo")
        || s.contains("redis")
        || s.contains("postgres")
        || s.contains("mysql")
        || s.contains("dynamo")
        || s.contains("rds")
        || s.contains("aurora")
        || s.contains("database")
        || s.contains("store")
        || s.contains("cache")
    {
        "db"
    } else if s.contains("queue")
        || s.contains("sqs")
        || s.contains("rabbit")
        || s.contains("kafka")
        || s.contains("worker")
        || s.contains("consumer")
        || s.contains("producer")
        || s.contains("sns")
        || s.contains("topic")
        || s.contains("bus")
    {
        "queue"
    } else {
        "http"
    }
}

/// Classify a log message as "ERROR", "WARN", "INFO", or "DEBUG".
fn extract_log_level(message: &str) -> &'static str {
    let trimmed = message.trim();
    // JSON
    if trimmed.starts_with('{') {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Some(level) = val.get("level").and_then(|v| v.as_str()) {
                let u = level.to_uppercase();
                return if u.contains("ERROR") || u.contains("FATAL") || u.contains("CRIT") {
                    "ERROR"
                } else if u.contains("WARN") {
                    "WARN"
                } else if u.contains("DEBUG") || u.contains("TRACE") {
                    "DEBUG"
                } else {
                    "INFO"
                };
            }
        }
    }

    let m = message.to_lowercase();
    if m.contains("[error]")
        || m.contains("\terror\t")
        || m.contains("fatal")
        || m.contains("exception")
        || m.contains("traceback")
        || m.contains("panic")
    {
        "ERROR"
    } else if m.contains("[warn]") || m.contains("\twarn\t") || m.contains("warning") {
        "WARN"
    } else if m.contains("[debug]") || m.contains("\tdebug\t") || m.contains("[trace]") {
        "DEBUG"
    } else {
        "INFO"
    }
}

/// Generate a simple rule-based AI insight from the timeline operations and log lines.
fn build_ai_insight(request_id: &str, timeline: &[TimelineOp], logs: &[LogLine]) -> AiInsight {
    let errors: Vec<&TimelineOp> = timeline.iter().filter(|o| o.state == "error").collect();
    let warnings: Vec<&TimelineOp> = timeline.iter().filter(|o| o.state == "warning").collect();
    let error_logs: Vec<&LogLine> = logs.iter().filter(|l| l.level == "ERROR").collect();
    // `logs` may omit structured ERROR level but still be error-like; prefer ERROR rows then any retained line.
    let evidence_logs: Vec<&LogLine> = if !error_logs.is_empty() {
        error_logs.into_iter().take(2).collect()
    } else {
        logs.iter().take(2).collect()
    };

    if errors.is_empty() && warnings.is_empty() {
        return AiInsight {
            summary_lead: "All operations completed successfully.".to_string(),
            summary: "No errors or performance anomalies were detected in this trace.".to_string(),
            root_cause: vec![],
            suggested_fix: vec![SuggestedFix {
                step: "No action required.".to_string(),
                code: None,
            }],
            confidence: 0.9,
            confidence_label: "High".to_string(),
        };
    }

    if !errors.is_empty() {
        let mut root_cause: Vec<String> = errors
            .iter()
            .map(|e| {
                format!(
                    "`{}` ({}) returned an error{}.",
                    e.service,
                    e.endpoint,
                    e.http_status
                        .map(|s| format!(" HTTP {}", s))
                        .unwrap_or_default()
                )
            })
            .collect();

        // Include first two error log lines as supporting evidence
        for log in &evidence_logs {
            let snippet: String = log.text.chars().take(160).collect();
            root_cause.push(format!("Log evidence: `{}`", snippet.trim()));
        }

        let suggested_fix = vec![
            SuggestedFix {
                step: format!(
                    "Investigate `{}` around the timestamp of this request.",
                    errors[0].service
                ),
                code: Some(format!(
                    "aws logs filter-log-events --log-group-name <group> \\\n  --filter-pattern \"{}\"",
                    request_id
                )),
            },
            SuggestedFix {
                step: "Check CloudWatch Metrics for the affected service(s) in the same window."
                    .to_string(),
                code: None,
            },
        ];

        AiInsight {
            summary_lead: format!(
                "Request failed with {} error(s) across {} service(s).",
                errors.len(),
                errors.len()
            ),
            summary: evidence_logs
                .first()
                .map(|l| l.text.chars().take(200).collect::<String>())
                .unwrap_or_else(|| format!("Error detected in `{}`.", errors[0].service)),
            root_cause,
            suggested_fix,
            confidence: 0.75,
            confidence_label: "Medium".to_string(),
        }
    } else {
        // Warnings only
        let root_cause: Vec<String> = warnings
            .iter()
            .map(|w| {
                format!(
                    "`{}` ({}) was degraded{}.",
                    w.service,
                    w.endpoint,
                    w.latency_ms
                        .map(|ms| format!(" — {} ms latency", ms))
                        .unwrap_or_default()
                )
            })
            .collect();

        let slowest = warnings
            .iter()
            .max_by_key(|w| w.latency_ms.unwrap_or(0));

        let suggested_fix = vec![SuggestedFix {
            step: format!(
                "Investigate latency spike in `{}`.",
                slowest.map(|w| w.service.as_str()).unwrap_or("service")
            ),
            code: None,
        }];

        AiInsight {
            summary_lead: format!("No hard errors; {} warning(s) detected.", warnings.len()),
            summary: "Degraded performance detected. All operations eventually succeeded."
                .to_string(),
            root_cause,
            suggested_fix,
            confidence: 0.65,
            confidence_label: "Medium".to_string(),
        }
    }
}

/// Build a full `RequestDetail` from raw events correlated for a single request.
fn build_request_detail(id: String, events: Vec<RawEvent>) -> RequestDetail {
    let mut error_count = 0u32;
    let mut warning_count = 0u32;
    let mut last_seen_ms = 0i64;

    // Preserve insertion order of services with a BTreeMap-backed ordered map
    let mut service_order: Vec<String> = Vec::new();
    let mut service_events: HashMap<String, Vec<(i64, String)>> = HashMap::new();

    for event in &events {
        if !service_events.contains_key(&event.service) {
            service_order.push(event.service.clone());
        }
        service_events
            .entry(event.service.clone())
            .or_default()
            .push((event.timestamp_ms, event.message.clone()));

        if event.timestamp_ms > last_seen_ms {
            last_seen_ms = event.timestamp_ms;
        }
        match classify_message(&event.message) {
            "error" => error_count += 1,
            "warning" => warning_count += 1,
            _ => {}
        }
    }

    let mut timeline: Vec<TimelineOp> = Vec::new();
    let mut logs: Vec<LogLine> = Vec::new();

    for service in &service_order {
        let svc_evs = &service_events[service];

        let first_ts = svc_evs.iter().map(|(ts, _)| *ts).min().unwrap_or(0);
        let last_ts = svc_evs.iter().map(|(ts, _)| *ts).max().unwrap_or(0);
        let latency_ms = if last_ts > first_ts {
            Some(last_ts - first_ts)
        } else {
            None
        };

        let mut svc_errors = 0u32;
        let mut svc_warns = 0u32;
        for (_, msg) in svc_evs {
            match classify_message(msg) {
                "error" => svc_errors += 1,
                "warning" => svc_warns += 1,
                _ => {}
            }
        }
        let state = if svc_errors > 0 {
            "error"
        } else if svc_warns > 0 {
            "warning"
        } else {
            "success"
        };

        // Best-effort endpoint + HTTP status extraction
        let http_info = svc_evs
            .iter()
            .find_map(|(_, msg)| extract_http_info(msg));
        let (endpoint, http_status) = match http_info {
            Some((ep, st)) => (ep, st),
            None => (service.clone(), None),
        };

        let op_id = format!("op-{}", service.replace('/', "-"));
        let kind = detect_op_kind(service);

        timeline.push(TimelineOp {
            id: op_id.clone(),
            service: service.clone(),
            endpoint,
            latency_ms,
            http_status,
            state: state.to_string(),
            kind: kind.to_string(),
        });

        let mut log_i = 0usize;
        for (_, msg) in svc_evs.iter() {
            if !matches!(classify_message(msg), "error" | "warning") {
                continue;
            }
            logs.push(LogLine {
                id: format!("log-{}-{}", service.replace('/', "-"), log_i),
                level: extract_log_level(msg).to_string(),
                text: msg.clone(),
                op_id: Some(op_id.clone()),
            });
            log_i += 1;
        }
    }

    let op_count = events.len() as u32;
    let success_count = op_count.saturating_sub(error_count + warning_count);
    let total = op_count as f64;
    let segments = if total == 0.0 {
        vec![StripSegment {
            seg_type: "success".to_string(),
            ratio: 1.0,
        }]
    } else {
        let mut segs = Vec::new();
        if error_count > 0 {
            segs.push(StripSegment {
                seg_type: "error".to_string(),
                ratio: error_count as f64 / total,
            });
        }
        if warning_count > 0 {
            segs.push(StripSegment {
                seg_type: "warning".to_string(),
                ratio: warning_count as f64 / total,
            });
        }
        if success_count > 0 {
            segs.push(StripSegment {
                seg_type: "success".to_string(),
                ratio: success_count as f64 / total,
            });
        }
        segs
    };

    let last_seen = DateTime::from_timestamp_millis(last_seen_ms)
        .unwrap_or_else(Utc::now)
        .to_rfc3339();

    let ai = build_ai_insight(&id, &timeline, &logs);

    RequestDetail {
        id,
        error_count,
        warning_count,
        op_count,
        last_seen,
        segments,
        timeline,
        logs,
        ai,
    }
}

// ─── fetch_request_detail command ────────────────────────────────────────────

/// Fetch all log events for a single correlated request ID and build a full detail view.
///
/// For real request IDs: uses `filter_log_events` with the ID as the filter pattern.
/// For synthetic IDs (`service#window`): re-fetches the 5-minute window for that service.
#[tauri::command]
async fn fetch_request_detail(
    request_id: String,
    log_group_names: Vec<String>,
    start_time_ms: i64,
    end_time_ms: i64,
    profile: Option<String>,
    region: Option<String>,
) -> Result<Option<RequestDetail>, String> {
    if log_group_names.is_empty() {
        return Ok(None);
    }

    let region_str = region.unwrap_or_else(|| "us-east-1".to_string());
    let client = make_client(profile.as_deref(), &region_str).await;

    let mut all_events: Vec<RawEvent> = Vec::new();

    if let Some(hash_pos) = request_id.rfind('#') {
        // Synthetic ID: "service-name#<unix-window>"
        let service = &request_id[..hash_pos];
        let window: i64 = request_id[hash_pos + 1..].parse().unwrap_or(0);
        let win_start = window * 5 * 60 * 1_000;
        let win_end = win_start + 5 * 60 * 1_000;

        if let Some(group_name) = log_group_names.iter().find(|g| {
            let (_, svc) = parse_log_group_path(g);
            svc == service
        }) {
            all_events = fetch_events_for_group(&client, group_name, win_start, win_end).await;
        }
    } else {
        // Real ID: search all groups in parallel using it as a CloudWatch filter pattern.
        // Wrapping in quotes forces an exact phrase match.
        let pattern = format!("\"{}\"", request_id);

        let mut join_set = tokio::task::JoinSet::new();
        for group_name in log_group_names.into_iter().take(30) {
            let client = client.clone();
            let pat = pattern.clone();
            let start = start_time_ms;
            let end = end_time_ms;
            join_set.spawn(async move {
                let (_, service) = parse_log_group_path(&group_name);
                let mut events: Vec<RawEvent> = Vec::new();
                let mut next_token: Option<String> = None;
                let mut pages = 0usize;

                loop {
                    let mut req = client
                        .filter_log_events()
                        .log_group_name(&group_name)
                        .filter_pattern(&pat)
                        .start_time(start)
                        .end_time(end)
                        .limit(500);

                    if let Some(ref t) = next_token {
                        req = req.next_token(t);
                    }

                    match req.send().await {
                        Ok(resp) => {
                            for ev in resp.events() {
                                if let (Some(msg), Some(ts)) =
                                    (ev.message(), ev.timestamp())
                                {
                                    events.push(RawEvent {
                                        service: service.clone(),
                                        timestamp_ms: ts,
                                        message: msg.to_string(),
                                    });
                                }
                            }
                            next_token = resp.next_token().map(|s| s.to_string());
                            pages += 1;
                            if next_token.is_none() || pages >= 5 || events.len() >= 2_000 {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
                events
            });
        }

        while let Some(result) = join_set.join_next().await {
            if let Ok(evs) = result {
                all_events.extend(evs);
            }
        }
    }

    if all_events.is_empty() {
        return Ok(None);
    }

    // Sort by timestamp for a chronological display
    all_events.sort_by_key(|e| e.timestamp_ms);

    Ok(Some(build_request_detail(request_id, all_events)))
}

// ─── Entry-point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_aws_profiles,
            list_log_groups,
            fetch_observed_requests,
            fetch_request_detail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
