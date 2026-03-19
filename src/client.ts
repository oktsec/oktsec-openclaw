/**
 * HTTP client for the oktsec gateway.
 * All communication between the plugin and oktsec goes through this module.
 */

export interface OktsecConfig {
  gatewayUrl: string;
  dashboardUrl: string;
  agent: string;
  mode: "enforce" | "observe";
}

export interface HookDecision {
  decision: "allow" | "block";
  reason?: string;
  rules_triggered?: string;
  status?: string;
}

export interface ToolEvent {
  tool_name: string;
  tool_input: string;
  event: "pre_tool_call" | "post_tool_call";
  agent?: string;
  session_id?: string;
  timestamp?: string;
}

export interface HealthResponse {
  status: string;
  version?: string;
}

export interface StatsResponse {
  total: number;
  delivered: number;
  blocked: number;
  quarantined: number;
  rejected: number;
}

const DEFAULT_TIMEOUT = 5000;

export class OktsecClient {
  private baseUrl: string;
  private agent: string;

  constructor(config: OktsecConfig) {
    this.baseUrl = config.gatewayUrl.replace(/\/$/, "");
    this.agent = config.agent;
  }

  /** Forward a tool call event to oktsec for scanning. */
  async sendToolEvent(event: ToolEvent): Promise<HookDecision> {
    const body: ToolEvent = {
      ...event,
      agent: event.agent || this.agent,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    const res = await fetch(`${this.baseUrl}/hooks/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Oktsec-Agent": body.agent!,
        "X-Oktsec-Client": "openclaw",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!res.ok) {
      return { decision: "allow", reason: `oktsec returned ${res.status}` };
    }

    return (await res.json()) as HookDecision;
  }

  /** Check if oktsec gateway is reachable. */
  async health(): Promise<HealthResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      return (await res.json()) as HealthResponse;
    } catch {
      return null;
    }
  }

  /** Get pipeline statistics. */
  async stats(): Promise<StatsResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/dashboard/api/stats`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      return (await res.json()) as StatsResponse;
    } catch {
      return null;
    }
  }

  /** Subscribe to audit events via SSE. Yields events as they arrive. */
  async *streamEvents(): AsyncGenerator<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/dashboard/api/events`, {
      headers: { Accept: "text/event-stream" },
    });

    if (!res.ok || !res.body) return;

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6));
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }
}
