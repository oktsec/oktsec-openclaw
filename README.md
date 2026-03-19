# oktsec plugin for OpenClaw

Runtime security for AI agent tool calls. Intercepts every tool call before execution, scans through 188 detection rules, and blocks threats in real-time.

## Install

```bash
openclaw plugins install @oktsec/openclaw
```

## Prerequisites

oktsec must be running:

```bash
brew install oktsec/tap/oktsec
oktsec run
```

## Configuration

In your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "oktsec": {
        "enabled": true,
        "config": {
          "gatewayUrl": "http://127.0.0.1:9090",
          "mode": "enforce",
          "agent": "openclaw"
        }
      }
    }
  }
}
```

## What it does

Every tool call your OpenClaw agent makes goes through oktsec's security pipeline before execution:

- **188 detection rules** across 15 categories (prompt injection, credential leaks, data exfiltration, supply chain attacks, and more)
- **4 verdicts**: clean (allow), flag (allow + warn), quarantine (hold for review), block (reject)
- **Tamper-evident audit trail** with SHA-256 hash chain and Ed25519 signatures
- **Real-time dashboard** at localhost:8080/dashboard

In enforce mode, blocked tool calls are rejected before they execute. In observe mode, everything is logged but nothing is blocked.

## Commands

### Chat

```
/oktsec status     # Pipeline health and stats
/oktsec dashboard  # Open dashboard URL
```

### CLI

```bash
openclaw oktsec status       # Gateway health and pipeline stats
openclaw oktsec logs -f      # Stream audit events
openclaw oktsec dashboard    # Open dashboard in browser
```

## How it works

The plugin is a thin TypeScript client. All security logic runs in the oktsec Go binary:

```
OpenClaw agent → tool call → oktsec plugin → oktsec gateway (188 rules) → allow/block
```

If oktsec gateway is unreachable, the plugin fails open (does not block agent work).

## Works with NemoClaw

oktsec and NemoClaw are complementary. NemoClaw sandboxes the agent (isolation + inference). oktsec monitors what the agent does (detection + audit + authorization). Both run as OpenClaw plugins simultaneously.

## License

Apache 2.0
