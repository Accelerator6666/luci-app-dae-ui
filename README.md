# luci-app-dae-ui

A modern LuCI management UI for **dae**, designed from three references without cloning any one of them:

- `QiuSimons/luci-app-honk`: OpenWrt package layout, rpcd/Ucode patterns, service lifecycle integration.
- `Zakkaus/doona`: information architecture and UX ideas such as activity/status, connections, DNS, policies, routing, nodes, config and logs.
- Doona docs/API contract: a capability-driven model for future dae native API integration.

## Design principle

This package must be useful **today** with normal dae installations. It therefore manages what dae already exposes locally: process state, config files, `dae validate`, `dae reload`, logs and system diagnostics. It does **not** fabricate Doona resources that dae does not currently expose.

When dae implements the shared daeuniverse native API contract, the Native API page becomes the integration point for connections, DNS telemetry, policy selection, route traces, activity history and other runtime resources.

## v0.13.0

- Live Overview with process, memory, version, config validation, discovered config-file count and eBPF interface state.
- Runtime Dashboard with 2-second polling for process CPU, memory, process uptime, socket FDs and `dae0`/`dae0peer` interface counters.
- Start / stop / restart / hot reload / suspend controls.
- Added a persistent **DAE Version Manager** under **Services → DAE → DAE Versions**.
  - Keeps each installed binary in an immutable slot below `/usr/lib/dae-ui/versions/<slot>/dae`.
  - Official releases are discovered from `daeuniverse/dae` only on demand and filtered to assets matching the router architecture.
  - x86_64 can choose the upstream v1, v2/SSE and v3/AVX2 release assets; unsupported CPU variants are rejected by the execution smoke test before installation.
  - Downloads are accepted only after a trusted SHA256 from fresh GitHub release metadata or the official `.dgst` asset matches the archive.
  - The extracted binary must execute successfully and run `dae validate` against the **actual OpenWrt dae service config** before it is installed.
  - Downloading a version never activates it automatically.
  - **Activate & Restart** validates again, persists the selected slot, restarts dae and verifies that `/proc/<pid>/exe` points at the requested slot before marking it **last-good**.
  - A failed runtime restart automatically restores the previous last-good/system slot and restarts dae.
  - Version switching never moves, rewrites or deletes the user's `.dae` configuration files.
- Reboot-safe binary selection:
  - The original package-managed `/usr/bin/dae` is copied into the protected `system` slot before the manager first takes control.
  - `/usr/bin/dae` then becomes a stable runner that dispatches to the persisted selected slot, so the existing OpenWrt `/etc/init.d/dae` remains unchanged.
  - `/etc/init.d/dae-ui-version` runs at **START=98**, before the upstream dae service at **START=99**.
  - On every boot it validates the persisted selected binary against the service configuration; if that fails it tries **last-good**, then the captured **system** binary.
  - A fallback changes only the selected binary state; it does not roll back or alter configuration text.
  - If the normal dae package later overwrites `/usr/bin/dae`, the boot guard captures that new package binary as the new `system` slot, preserves the previous system binary in an immutable `system-prev-*` rollback slot, and reinstalls the runner.
  - Backend validate/reload operations call the selected slot directly, so a package overwrite of `/usr/bin/dae` cannot silently change LuCI's active binary before reboot.
  - Start/Restart actions repair the runner first when version management is enabled.
  - Removing luci-app-dae-ui restores the captured system binary to `/usr/bin/dae` when the managed runner still owns that path.
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
- Native runtime pages remain conservative: connection close, group selection, DNS cache mutation and arbitrary Native API writes are not exposed. The only active Native operations are explicit diagnostic routing trace, diagnostic DNS query, and user-requested bounded probes.
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
- Added a capability-gated **Native DNS Rule Dictionary** backed by `GET /api/v1/dns/rules`.
  - Request and response rules are displayed separately in evaluation order, including the backend-reported fallback entries.
  - Request actions expose `upstream / asis / reject`; response actions expose `accept / reject / requery`, with resolved upstream names when applicable.
  - DNS rule source navigation follows the same safe source-ID model as traffic rules: `source_id → GET /api/v1/config → exact local .dae path`; the display-only source file label is never used as a file-access path.
  - Generation-qualified links can open an exact request/response DNS rule only when the requested generation matches the currently loaded complete DNS dictionary.

  - Rules are tied to the running `generation_id` and displayed with rule ID, evaluation index, kind, expression, outbound, must flag and source metadata.
  - Rule source navigation never treats the rule's display-only `file` label as a local path.
  - The UI joins `rule.source.source_id` to `GET /api/v1/config`, then links into the local editor only if that Native source path exactly matches a locally discovered `.dae` file.
- Added capability-driven **Node Probe** actions when `probes` and `operations` are available.
  - Probe kind, transport and IP family are derived from the backend's advertised probe contract.
  - `tcp_connect` and `http` are constrained to TCP; DNS probes use only advertised DNS-capable transports.
  - No probe runs automatically or on page refresh; opening the dialog is not enough — the user must press **Run probe**.
  - rpcd re-reads capabilities before submission and rejects unadvertised target/kind/transport/IP combinations.
  - The UI polls only the returned operation ID, respects Retry-After, and stops after 60 seconds if one operation remains nonterminal.
- Added capability-sized **Group Probe** support.
  - Only direct group members are probed.
  - Group details are read first so the group's own `probe_transports` restriction is respected.
  - Direct members are split into explicit member-ID batches using `max_members_per_job` and `max_results_per_job`.
  - Batches run sequentially; the next operation is not submitted until the previous operation reaches a terminal state.
  - Partial results remain visible if a later batch fails.
- Flow timelines now resolve all routing chains with the correct dictionary:
  - `traffic` → traffic Rules Dictionary;
  - `dns_upstream` → traffic Rules Dictionary, because upstream transport routing uses traffic routing inputs;
  - `dns_request` → DNS request rules;
  - `dns_response` → DNS response rules.
  - Both the winning route rule and every retained rule-evaluation row become links only when the step's `generation_id` exactly matches the corresponding current dictionary.
  - DNS route steps also expose `dns_action` and DNS evidence shows `route_evaluation_ids` so a recorded lookup can be related back to its retained routing evaluations.
- Added a reusable **Retained Flow Trace Timeline** renderer.
  - Flow detail is read only from the fixed `GET /api/v1/flows/{flow_id}` path.
  - Timeline steps are sorted by `seq` and render the full causal chain: input, traffic/DNS route evaluation, datapath action, dial mode, DNS evidence, reroute decision, outbound selection and connection milestones.
  - Every step preserves `observed_at`, `elapsed_us`, `generation_id` and evidence type, with raw step JSON available under a disclosure panel.
  - Route steps render the backend's rule-evaluation list; outbound steps render nested selection-path candidates, eligibility, latency, score and selected state when retained.
  - Trace status and missing-evidence reasons remain visible for partial/disabled traces instead of presenting them as complete.
- Added **Connections → Flow Timeline** drill-down.
  - A connection gets a Timeline action only when the backend returned a real `flow_id`.
  - The UI never manufactures a flow ID for an unrecorded live connection.
  - The same generation-safe traffic-rule links are reused inside connection-launched timelines.
- Added generation-safe **Flow → Rule** association.
  - Clicking a flow rule ID reads the retained flow detail and current rule dictionary.
  - The UI requires a retained `route` step with `chain=traffic`, the same `rule_id`, and a non-null `generation_id`.
  - A rule link is offered only when that generation exactly equals the current Rules Dictionary `generation_id`.
  - Missing retained evidence or a generation mismatch is shown explicitly; no cross-generation rule guess is made.
- Native API Discovery also shows the advertised probe targets, kinds, transports, IP versions and job limits.
- Added capability-gated **Native Diagnostics**:
  - DNS Query uses the standard read-only `GET /api/v1/dns/query` with a typed query whitelist and visible request preview.
  - Routing Trace uses only `POST /api/v1/routing/trace`, constructing a bounded `RoutingTraceRequest` server-side. The UI labels the result as a hypothetical simulation, never a recorded flow.
  - No connection close, policy mutation, DNS cache delete/flush, config write, or arbitrary Native API POST is exposed. Probe operations remain isolated to the dedicated capability-bounded probe workflow.
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

## v0.14 work in progress

Implemented on main:

- Context-aware CodeMirror completion for DAE sections, routing matchers, group policies and configured outbound groups, plus inline validation diagnostics in the editor gutter.
- Native generation-consistency reporting in Runtime and a compact Native API / generation snapshot on Overview.
- Local 60-second and 5-minute dae0 traffic trends derived from kernel interface counters, plus a recent WARN / ERROR marker summary.
- Source node and subscription cards can correlate exact tags with Native runtime latency/inventory data without rewriting source configuration.
- Policy Groups now has a visual staged builder for exact node tags, subscription tags and supported policy syntax, while retaining Preview diff before writes.
- Native runtime policy cards can display current TCP/UDP selection snapshots for exact group-name matches.
- Retained flow traces now have a dedicated hidden detail route keyed by backend flow ID, with generation-safe rule links and direct Open page links from Flows and Connections.

Still planned:

- Optional local-binary import for custom dae builds, using the same smoke-test / config-validation / immutable-slot safety model.
- GeoData pin refresh automation tied to dae upstream changes.
- More protocol-aware structured node/subscription forms while preserving raw DAE syntax.

## Native API token security

The optional Native API token is deliberately separate from normal UCI settings. `/etc/config/dae-ui` contains paths and UI settings only; the token lives in a root-only file. The UI can replace or remove it but cannot read it back. The rpcd gateway continues to allow only a fixed GET resource list and typed query parameters even after authentication is configured.

## License

GPL-3.0-only.
