/**
 * Tool call interception hooks.
 * Forwards every tool call to oktsec gateway before and after execution.
 */

import { OktsecClient, type OktsecConfig } from "./client.js";

export interface ToolCallEvent {
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId?: string;
  agentId?: string;
}

export interface HookResult {
  block?: boolean;
  reason?: string;
}

/**
 * Creates pre and post tool call handlers wired to an oktsec gateway.
 */
export function createHooks(config: OktsecConfig) {
  const client = new OktsecClient(config);
  const mode = config.mode || "enforce";

  return {
    /**
     * Called before a tool executes. Returns block decision.
     * In observe mode, never blocks (logs only).
     */
    async preToolCall(event: ToolCallEvent): Promise<HookResult> {
      try {
        const decision = await client.sendToolEvent({
          tool_name: event.toolName,
          tool_input: JSON.stringify(event.toolInput),
          event: "pre_tool_call",
          session_id: event.sessionId,
          agent: event.agentId,
        });

        if (decision.decision === "block" && mode === "enforce") {
          return {
            block: true,
            reason: decision.reason || "oktsec: threat detected",
          };
        }

        return { block: false };
      } catch {
        // If oktsec is unreachable, fail open (don't block agent work)
        return { block: false };
      }
    },

    /**
     * Called after a tool executes. Logs the result to audit trail.
     */
    async postToolCall(event: ToolCallEvent): Promise<void> {
      try {
        await client.sendToolEvent({
          tool_name: event.toolName,
          tool_input: JSON.stringify(event.toolInput),
          event: "post_tool_call",
          session_id: event.sessionId,
          agent: event.agentId,
        });
      } catch {
        // Non-blocking: audit logging should not break agent workflow
      }
    },

    /** Expose client for status/health checks. */
    client,
  };
}
