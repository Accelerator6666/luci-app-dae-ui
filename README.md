# luci-app-dae-ui

A modern LuCI management UI for **dae**, designed from three references without cloning any one of them:

- `QiuSimons/luci-app-honk`: OpenWrt package layout, rpcd/Ucode patterns, service lifecycle integration.
- `Zakkaus/doona`: information architecture and UX ideas such as activity/status, connections, DNS, policies, routing, nodes, config and logs.
- Doona docs/API contract: a capability-driven model for future dae native API integration.

## Design principle

This package must be useful **today** with normal dae installations. It therefore manages what dae already exposes locally: process state, config files, `dae validate`, `dae reload`, logs and system diagnostics. It does **not** fabricate Doona resources that dae does not currently expose.

When dae implements the shared daeuniverse native API contract, the Native API page becomes the integration point for connections, DNS telemetry, policy selection, route traces, activity history and other runtime resources.

## v0.9.0

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
- Native API discovery page that probes `/api` and `/api/v1/capabilities` locally without extracting `native_api.secret` from dae configuration.
- Native runtime pages remain read-only: no connection close, group selection, probe start, DNS flush/delete, routing trace POST or other mutation is issued.
- Runtime capability matrix that clearly separates local telemetry from Native-API-only resources such as detailed connections, node probes, policy runtime selection, flows, routing trace and DNS telemetry.
- Capability-driven hidden runtime pages for Connections, Nodes & Latency, Runtime Policies, Flows and DNS Runtime. Runtime only exposes entry buttons when `/api/v1/capabilities` reports the corresponding resource as available.
- A whitelisted read-only Native API gateway: the LuCI frontend can request only known GET resources and cannot supply arbitrary URLs or invoke Native API mutations.
- Optional Native API token mode:
  - the token is entered once in LuCI;
  - stored outside UCI at `/etc/dae-ui/native-api.token`;
  - directory mode 0700 and token mode 0600;
  - never returned by rpcd to browser JavaScript;
  - never copied from `native_api.secret` automatically;
  - used only by server-side curl through a temporary root-only curl config;
  - removed when the package is uninstalled.
- Native Connections, Nodes, Flows and DNS Runtime provide local search, filtering, sortable columns and 25/50/100/200-row client-side paging.
- Nodes, Flows, DNS cache and DNS log now support incremental Native API cursor loading. The first page remains live; loading a second server page freezes the current snapshot so subsequent rows cannot be silently mixed with a newer generation. “Restart live snapshot” explicitly returns to first-page polling.
- Cursor walks are bounded to 5000 locally retained rows per dataset; expired/invalid cursors are reported instead of silently restarting against another snapshot.
- The backend request whitelist supports the contract's safe read query fields such as connection type/source, node group/cursor, flow network/state/cursor, and DNS name/type/source/cursor.
- Validation output is parsed for safe `*.dae:line:column` locations. Save failures and Diagnostics can link directly to **Configuration Files**, select the source file and scroll the local editor to the reported line.
- Config Sources, All Sections, and existing structured-section views now link source labels back to their actual `.dae` files.
- Added a capability-gated **Native Rule Dictionary** backed by `GET /api/v1/rules`.
  - Rules are tied to the running `generation_id` and displayed with rule ID, evaluation index, kind, expression, outbound, must flag and source metadata.
  - Rule source navigation never treats the rule's display-only `file` label as a local path.
  - The UI joins `rule.source.source_id` to `GET /api/v1/config`, then links into the local editor only if that Native source path exactly matches a locally discovered `.dae` file.
- Added explicit **TCP Node Probe** actions to Native Nodes when both `probes` and `operations` capabilities are available.
  - No probe runs automatically or on page refresh.
  - Every probe requires an explicit button click plus confirmation.
  - The backend constructs one fixed `tcp_connect` node probe request; the browser cannot send arbitrary probe JSON.
  - The UI polls only the operation ID returned by that probe, respects the advertised Retry-After floor, and stops after 60 seconds if the operation is still nonterminal.
  - Probe results show state, latency, resolved leaf, IP version, health-update status and backend error text.
- Added capability-gated **Native Diagnostics**:
  - DNS Query uses the standard read-only `GET /api/v1/dns/query` with a typed query whitelist and visible request preview.
  - Routing Trace uses only `POST /api/v1/routing/trace`, constructing a bounded `RoutingTraceRequest` server-side. The UI labels the result as a hypothetical simulation, never a recorded flow.
  - No connection close, policy mutation, DNS cache delete/flush, config write, probe start, or arbitrary Native API POST is exposed.
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

## Planned v0.10

- Optional group-target probes using the backend-advertised probe kinds/transports/limits instead of fixed defaults.
- Rule-aware joins from retained flow evidence to the matching generation dictionary where the Native API exposes enough generation context.
- GeoData pin refresh automation tied to dae upstream changes.
- Better protocol-aware structured node/subscription forms while preserving raw DAE syntax.

## Native API token security

The optional Native API token is deliberately separate from normal UCI settings. `/etc/config/dae-ui` contains paths and UI settings only; the token lives in a root-only file. The UI can replace or remove it but cannot read it back. The rpcd gateway continues to allow only a fixed GET resource list and typed query parameters even after authentication is configured.

## License

GPL-3.0-only.
