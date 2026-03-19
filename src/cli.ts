/**
 * CLI subcommand registration for `openclaw oktsec <command>`.
 */

import type { OktsecConfig } from "./client.js";
import { cliStatus } from "./commands/status.js";
import { cliLogs } from "./commands/logs.js";

interface Commander {
  command(name: string): Commander;
  description(desc: string): Commander;
  option(flags: string, desc: string, defaultValue?: unknown): Commander;
  action(fn: (...args: unknown[]) => Promise<void>): Commander;
}

export function registerCliCommands(
  program: Commander,
  config: OktsecConfig,
  log: (msg: string) => void,
) {
  program
    .command("status")
    .description("Show oktsec gateway health and pipeline stats")
    .option("--json", "Output as JSON")
    .action(async (...args: unknown[]) => {
      const opts = (args[0] || {}) as { json?: boolean };
      await cliStatus(config, opts, log);
    });

  program
    .command("logs")
    .description("Stream audit events from oktsec")
    .option("-f, --follow", "Keep streaming (default: stop after buffer)")
    .option("-n, --lines <n>", "Number of events to show", 50)
    .action(async (...args: unknown[]) => {
      const opts = (args[0] || {}) as { follow?: boolean; lines?: number };
      await cliLogs(config, opts, log);
    });

  program
    .command("dashboard")
    .description("Open oktsec dashboard in browser")
    .action(async () => {
      const { exec } = await import("child_process");
      const url = config.dashboardUrl;
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${cmd} ${url}`);
      log("Opening " + url);
    });
}
