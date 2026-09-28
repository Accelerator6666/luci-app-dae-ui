# Changelog

## 0.7.0 - 2026-09-29

- Added optional Native API Bearer-token authentication without storing the token in UCI or reading `native_api.secret` from dae configuration.
- Stores the optional token in `/etc/dae-ui/native-api.token` with a private directory and mode 0600; rpcd never returns the token to browser JavaScript.
- Server-side curl uses a temporary root-only curl config for the Authorization header instead of placing the token in the request URL.
- Added replace/remove token controls to Native API Discovery and capability probing now retries authenticated reads when a token is configured.
- Added a typed query whitelist for Native API GET resources; arbitrary URLs and arbitrary query strings remain impossible through rpcd.
- Added reusable search/filter/sort/page controls for Native runtime datasets.
- Connections now loads up to 1000 records and supports local network/state/outbound filtering, search and sortable traffic columns.
- Nodes & Latency now supports protocol/provider filters, latency sorting and local pagination over a server page of up to 1000 nodes.
- Flows now supports network/state/outbound filtering, source/target search and local pagination over a server page of up to 1000 flows.
- DNS Runtime now adds searchable/filterable/sortable cache and log tables; DNS cache requests up to 1000 entries and DNS log up to 500 records.
- Pages explicitly report when the Native API returns a `next_cursor`; v0.7 does not silently mix another server snapshot into the current sorted page.
- Package uninstall removes the private Native API token file while preserving normal UCI configuration semantics.

## 0.6.0 - 2026-09-28

- Added a whitelisted read-only Native API GET gateway in rpcd; callers cannot pass arbitrary URLs or invoke API mutations.
- Added hidden capability-driven pages for Native Connections, Nodes & Latency, Runtime Policies, Flows and DNS Runtime.
- Runtime Dashboard shows navigation buttons only when `/api/v1/capabilities` explicitly reports the corresponding resource as available.
- Native Connections polls read-only full connection snapshots and shows network, state, source, target, outbound, process and transfer rates.
- Native Nodes shows protocol/provider/group membership and backend-reported TCP/UDP health latency observations.
- Runtime Policies combines `/groups` selection state with `/runtime/outbounds` counters when both are available.
- Native Flows renders retained flow summaries without issuing routing trace or other POST operations.
- DNS Runtime renders read-only cache and log resources without cache flush/delete/query mutations.
- Authentication-required resources remain unavailable; the LuCI backend still does not extract or replay the configured Native API secret.

## 0.5.0 - 2026-09-28

- Rebuilt the rpcd Ucode backend into one clean source after several incremental feature additions.
- Added Runtime Dashboard with 2-second local telemetry polling.
- Added process memory, CPU-tick based live CPU calculation, process uptime, socket-FD count and best-effort `ss` process socket count.
- Added `dae0` and `dae0peer` RX/TX byte, packet and live-rate counters from sysfs.
- Added a capability matrix that separates locally observable metrics from Native-API-only resources.
- Added local read-only Native API discovery against `/api` and `/api/v1/capabilities` without extracting or replaying the configured API secret.
- Detects Doona-compatible `api_major=1`, Bearer authentication challenges, backend name/base path and reported runtime resources when capabilities are public.
- Added Ucode structural sanity checks to CI so duplicated/truncated backend content is caught before merge.
- Moved live CPU display from Overview to Runtime, where the value is derived from poll deltas instead of a static process snapshot.

## 0.4.0 - 2026-09-28

- Added visual node/subscription cards with protocol detection for common one-line entries.
- Added policy-group cards, routing rule table and DNS upstream cards while preserving complex source blocks.
- Added staged diff preview before managed-section writes.
- Expanded Overview with process CPU, process uptime, interface inventory and default-route information.
- Added verified GeoData updater using the versions and SHA256 values pinned by dae upstream.
- GeoData update flow downloads to `/tmp`, verifies SHA256, backs up existing files and atomically installs replacements.
- Added `curl` package dependency for verified GeoData downloads.
- Expanded rpcd ACLs for diff preview and GeoData update actions.

## 0.3.0 - 2026-09-28

- Added safe managed config sections under `config.d/dae-ui-*.dae`.
- Managed writes are enabled only when the main configuration already includes `config.d/*.dae`.
- Added staged Nodes/Subscriptions, Policy Groups and Routing quick-entry forms.
- Added a managed DNS editor with a split-DNS starter template.
- Added Config Sources view with per-file recognized section ownership.
- Added GeoData presence/size detection for common OpenWrt and upstream DAE asset directories.
- Existing user-owned config blocks remain read-only in the structured pages; all managed writes still validate the complete main config and rollback on failure.
- Expanded rpcd ACLs for managed-section and GeoData status methods.

## 0.2.0 - 2026-09-28

- Added include-aware discovery for `.dae` files below the active configuration directory.
- Added safe per-file read/write RPCs; every write validates the complete main configuration before acceptance.
- Added local CodeMirror runtime, DAE syntax mode, bracket matching, auto-closing and folding without CDN dependencies.
- Added Configuration Files page with file switching and creation under `config.d/`.
- Added Nodes, Policies, Routing and DNS views with source-file attribution.
- Added backup history, diff, restore+validate and restore+reload.
- Expanded diagnostics with discovered config-file count.
- Added least-privilege rpcd ACL entries for the new read/write methods.
- Added third-party notices for the vendored local editor assets.

## 0.1.0 - 2026-09-28

- Initial independent DAE LuCI UI scaffold.
- Added Ucode rpcd backend, live status, service actions, safe config apply/rollback, config section view, diagnostics, logs, settings and native API readiness page.
