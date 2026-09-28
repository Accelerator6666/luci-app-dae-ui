# luci-app-dae-ui

A modern LuCI management UI for **dae**, designed from three references without cloning any one of them:

- `QiuSimons/luci-app-honk`: OpenWrt package layout, rpcd/Ucode patterns, service lifecycle integration.
- `Zakkaus/doona`: information architecture and UX ideas such as activity/status, connections, DNS, policies, routing, nodes, config and logs.
- Doona docs/API contract: a capability-driven model for future dae native API integration.

## Design principle

This package must be useful **today** with normal dae installations. It therefore manages what dae already exposes locally: process state, config files, `dae validate`, `dae reload`, logs and system diagnostics. It does **not** fabricate Doona resources that dae does not currently expose.

When dae implements the shared daeuniverse native API contract, the Native API page becomes the integration point for connections, DNS telemetry, policy selection, route traces, activity history and other runtime resources.

## v0.5.0

- Live Overview with process, memory, version, config validation, discovered config-file count and eBPF interface state.
- Runtime Dashboard with 2-second polling for process CPU, memory, process uptime, socket FDs and `dae0`/`dae0peer` interface counters.
- Start / stop / restart / hot reload / suspend controls.
- Local CodeMirror DAE editor with line numbers, DAE syntax highlighting, bracket matching, auto-close and folding.
- Include-aware multi-file configuration manager for `.dae` files under the active config directory.
- Safe configuration writes:
  - timestamped backup before write;
  - `dae validate` before acceptance;
  - hot reload after apply;
  - automatic rollback when validation or reload fails.
- Dedicated Nodes, Policies, Routing and DNS control pages with source-file attribution, visual cards/tables and safe staged managed sections.
- All Sections view for `global`, `subscription`, `node`, `group`, `routing`, `dns`, `experimental` blocks across discovered `.dae` files.
- Backup history with per-file diff, restore+validate and restore+reload.
- Safe managed config files under `config.d/dae-ui-*.dae`; the UI refuses managed writes unless the main config already includes `config.d/*.dae`.
- Quick staging forms for nodes, subscriptions, policy groups and routing rules; DNS gets a safe split-DNS template plus raw staged editing.
- Best-effort cards for nodes/subscriptions/policies, a routing summary table and DNS upstream cards; complex syntax always remains visible in source blocks.
- Staged diff preview before managed-section writes.
- Overview includes process uptime, discovered interfaces and the current default route; live CPU moved to Runtime where it is calculated from process CPU-tick deltas between polls.
- Config Sources page showing discovered files and recognized section ownership.
- GeoData status detection plus a verified updater that downloads dae-upstream pinned versions, validates SHA256, backs up existing files and atomically replaces them.
- Diagnostics page for process, validation, `dae0` and default route.
- Live log page with refresh, pause and clear.
- Native API discovery page that probes `/api` and `/api/v1/capabilities` locally without replaying or exposing the configured secret.
- Runtime capability matrix that clearly separates local telemetry from Native-API-only resources such as detailed connections, node probes, policy runtime selection, flows, routing trace and DNS telemetry.
- Configurable dae binary, init script, config path and log path through UCI.

## Install for development

Copy the project into an OpenWrt build tree as a package, or install the package files into the usual LuCI locations. Default runtime assumptions are:

```text
/usr/bin/dae
/etc/init.d/dae
/etc/dae/config.dae
/var/log/dae/dae.log
```

They can be changed under **Services → DAE → Settings**.

## Planned v0.6

- Optional authenticated Native API profile support without storing plaintext secrets in LuCI config.
- Read-only detailed Connections / Nodes / Policies pages when the backend explicitly reports those resources.
- Better parser diagnostics and click-through source navigation.
- GeoData pin refresh automation tied to dae upstream changes.

## License

GPL-3.0-only.
