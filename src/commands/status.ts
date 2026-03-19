/**
 * openclaw oktsec status - Show gateway health, pipeline stats, and mode.
 */

import { OktsecClient, type OktsecConfig } from "../client.js";

interface StatusOptions {
  json?: boolean;
}

export async function cliStatus(
  config: OktsecConfig,
  opts: StatusOptions,
  log: (msg: string) => void,
) {
  const client = new OktsecClient(config);

  const [health, stats] = await Promise.all([
    client.health(),
    client.stats(),
  ]);

  if (opts.json) {
    log(JSON.stringify({ health, stats, config: { mode: config.mode, gateway: config.gatewayUrl } }, null, 2));
    return;
  }

  if (!health) {
    log("oktsec gateway is not reachable at " + config.gatewayUrl);
    log("Start it with: oktsec run");
    return;
  }

  log("oktsec gateway");
  log("  Status:     " + health.status);
  if (health.version) log("  Version:    " + health.version);
  log("  Mode:       " + config.mode);
  log("  Gateway:    " + config.gatewayUrl);
  log("  Dashboard:  " + config.dashboardUrl);

  if (stats) {
    log("");
    log("Pipeline stats");
    log("  Total:        " + stats.total);
    log("  Delivered:    " + stats.delivered);
    log("  Blocked:      " + stats.blocked);
    log("  Quarantined:  " + stats.quarantined);
  }
}
