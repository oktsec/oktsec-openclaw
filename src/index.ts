/**
 * oktsec plugin for OpenClaw.
 *
 * Intercepts every tool call before execution, scans through 188 detection
 * rules, and blocks threats in real-time. Tamper-evident audit trail with
 * SHA-256 hash chain and Ed25519 signatures.
 *
 * The plugin is a thin client. All detection, policy enforcement, and audit
 * logging runs in the oktsec Go binary (gateway).
 */

import { createHooks } from "./hooks.js";
import { registerCliCommands } from "./cli.js";
import type { OktsecConfig } from "./client.js";

/**
 * OpenClaw Plugin API (subset of types used by this plugin).
 * Full types would come from openclaw/plugin-sdk in production.
 */
interface OpenClawPluginApi {
  id: string;
  name: string;
  version: string;
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;
  logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
  };
  registerCommand(opts: {
    name: string;
    description: string;
    handler: (args: string) => Promise<string>;
  }): void;
  registerCli(fn: (program: unknown) => void): void;
  registerHook(opts: {
    event: string;
    handler: (event: unknown) => Promise<unknown>;
  }): void;
  registerService(opts: {
    name: string;
    start: () => Promise<void>;
    stop?: () => Promise<void>;
  }): void;
}

function resolveConfig(api: OpenClawPluginApi): OktsecConfig {
  const pc = api.pluginConfig || {};
  return {
    gatewayUrl: (pc.gatewayUrl as string) || "http://127.0.0.1:9090",
    dashboardUrl: (pc.dashboardUrl as string) || "http://127.0.0.1:8080/dashboard",
    agent: (pc.agent as string) || "openclaw",
    mode: ((pc.mode as string) || "enforce") as "enforce" | "observe",
  };
}

export default function register(api: OpenClawPluginApi) {
  const config = resolveConfig(api);
  const hooks = createHooks(config);
  const log = api.logger;

  // 1. Tool call interception (core security feature)
  api.registerHook({
    event: "preToolCall",
    handler: async (event: unknown) => {
      const e = event as { toolName: string; toolInput: Record<string, unknown>; sessionId?: string };
      const result = await hooks.preToolCall({
        toolName: e.toolName,
        toolInput: e.toolInput,
        sessionId: e.sessionId,
      });
      if (result.block) {
        log.warn(`oktsec blocked ${e.toolName}: ${result.reason}`);
      }
      return result;
    },
  });

  api.registerHook({
    event: "postToolCall",
    handler: async (event: unknown) => {
      const e = event as { toolName: string; toolInput: Record<string, unknown>; sessionId?: string };
      await hooks.postToolCall({
        toolName: e.toolName,
        toolInput: e.toolInput,
        sessionId: e.sessionId,
      });
      return {};
    },
  });

  // 2. Slash command: /oktsec
  api.registerCommand({
    name: "oktsec",
    description: "Security status and controls",
    handler: async (args: string) => {
      const cmd = args.trim().split(/\s+/)[0] || "status";

      if (cmd === "status") {
        const health = await hooks.client.health();
        if (!health) return "oktsec gateway not reachable. Start with: oktsec run";
        const stats = await hooks.client.stats();
        let out = `oktsec: ${health.status} (${config.mode} mode)\n`;
        if (stats) {
          out += `Pipeline: ${stats.total} events, ${stats.blocked} blocked, ${stats.quarantined} quarantined\n`;
        }
        out += `Dashboard: ${config.dashboardUrl}`;
        return out;
      }

      if (cmd === "dashboard") {
        return `Open: ${config.dashboardUrl}`;
      }

      return "Usage: /oktsec [status|dashboard]";
    },
  });

  // 3. CLI subcommands: openclaw oktsec <cmd>
  api.registerCli((program: unknown) => {
    registerCliCommands(program as Parameters<typeof registerCliCommands>[0], config, (msg) => log.info(msg));
  });

  // 4. Background health monitor
  let healthInterval: ReturnType<typeof setInterval> | null = null;

  api.registerService({
    name: "oktsec-monitor",
    start: async () => {
      const health = await hooks.client.health();
      if (health) {
        log.info(`oktsec connected: ${config.gatewayUrl} (${config.mode} mode)`);
      } else {
        log.warn(`oktsec gateway not reachable at ${config.gatewayUrl}`);
      }

      // Periodic health check every 30s
      healthInterval = setInterval(async () => {
        const h = await hooks.client.health();
        if (!h) {
          log.warn("oktsec gateway connection lost");
        }
      }, 30_000);
    },
    stop: async () => {
      if (healthInterval) clearInterval(healthInterval);
    },
  });

  log.info(`oktsec plugin registered (${config.mode} mode, gateway: ${config.gatewayUrl})`);
}
