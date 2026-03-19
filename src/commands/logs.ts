/**
 * openclaw oktsec logs - Stream audit events from oktsec gateway via SSE.
 */

import { OktsecClient, type OktsecConfig } from "../client.js";

interface LogsOptions {
  follow?: boolean;
  lines?: number;
}

export async function cliLogs(
  config: OktsecConfig,
  opts: LogsOptions,
  log: (msg: string) => void,
) {
  const client = new OktsecClient(config);

  const health = await client.health();
  if (!health) {
    log("oktsec gateway is not reachable at " + config.gatewayUrl);
    return;
  }

  log("Streaming audit events from " + config.gatewayUrl + " ...");
  log("");

  let count = 0;
  const limit = opts.lines || 0;

  for await (const event of client.streamEvents()) {
    const ts = (event.timestamp as string || "").slice(11, 19);
    const agent = event.from_agent || "unknown";
    const tool = event.tool_name || event.to_agent || "";
    const status = event.status || "";

    log(`${ts}  ${padRight(agent as string, 16)} ${padRight(status as string, 12)} ${tool}`);

    count++;
    if (limit > 0 && count >= limit && !opts.follow) break;
  }
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
