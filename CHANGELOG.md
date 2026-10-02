# Changelog

## 0.14.3 - 2026-10-02

- Live Overview, Runtime, Logs, Connections, Flows, Native Nodes, Runtime Policies and DNS Runtime polling now pauses while the browser tab is hidden, reducing unnecessary rpcd and Native API work.
- Added a syntax-aware DAE configuration parser that preserves quoted `#`, escaped apostrophes, regex text and nested group syntax instead of using comment-stripping or group-splitting regexes.
- Policy-group summaries now parse the inner `group { ... }` body correctly and preserve multiple filter expressions as opaque DAE/honk syntax.
- Added field-level staged editors for tagged managed nodes and subscriptions; only the selected quoted URI value is replaced while tags, comments, spacing and unrelated entries remain unchanged.
- Added field-level staged editing for managed group policy/filter values. Filter expressions are not tokenized or normalized, and field mode deliberately refuses filter-count changes so complex edits remain in the raw validated editor.
- Added optimistic SHA256 revision guards to managed-section saves. If the managed file changes after the page loads, the backend refuses the stale write and returns the current body instead of overwriting newer changes.
- Added Copy Error controls plus an in-memory Recent Error Diagnostics panel. Only the latest 20 sanitized records are retained; RPC arguments, secrets and request bodies are never stored.
- Extended Simplified Chinese coverage and CI contract checks for the new polling, parser, conflict-protection and diagnostics behavior.

## 0.14.2 - 2026-10-02

- Added drag-and-drop local dae import on the DAE Version Manager page.
- Added direct archive import for `.zip`, `.tar.gz` and `.tgz`, in addition to raw dae executables.
- Archive imports use the existing fixed upload path and never accept an arbitrary server-side path through rpcd.
- Archive inspection rejects unsafe member paths, limits entry count, requires exactly one `dae` / `dae-*` payload and extracts only that payload to a private temporary file.
- Added an extraction file-size limit of 128 MiB to reduce archive-bomb risk.
- Added archive SHA256 metadata while keeping immutable slots addressed by the extracted binary SHA256.
- Archive or binary imports remain non-activating until the user explicitly selects **Activate & Restart**.
- Updated Simplified Chinese translations, documentation and CI safety-contract checks.

## 0.14.1 - 2026-10-02

- Added bundled Simplified Chinese (zh_Hans / zh-cn) localization that follows the LuCI system language automatically.
- Translated the complete current LuCI frontend string set, including menus, Overview, Runtime, configuration management, Native API pages, flow/rule diagnostics, GeoData and DAE Version Manager.
- Added centralized frontend localization for rpcd backend success/error messages so operational dialogs and notifications do not fall back to English during normal Chinese-language use.
- Added translations for dynamic backend message prefixes such as release download failures, SHA256 mismatches, install/backup failures and service-action completion.
- Added `README.zh-CN.md` and reciprocal language links between the English and Simplified Chinese project documentation.
- Kept technical identifiers such as DAE, Native API, GeoData, SHA256, PID, eBPF, TCP/UDP and IPv4/IPv6 unchanged where translating them would reduce clarity.
- Bumped package version to 0.14.1.

## 0.14.0 - 2026-10-02

- Added contextual DAE completion to the local CodeMirror editor. `Ctrl+Space` suggests section-aware global, group, DNS and routing syntax and can complete configured proxy-group names after routing arrows/fallbacks.
- Added inline validation diagnostics in the configuration editor gutter and automatic navigation to the first validation error in the active file while retaining the existing full diagnostics modal.
- Added a read-only Native generation-consistency panel on Runtime. It compares generation IDs reported by available config, traffic-rule and DNS-rule dictionaries and explicitly avoids inferring desired-vs-active state when the backend does not report it.
- DaedNext is now documented as a product-UX and RoutingA language-tooling reference; its application code and runtime are not bundled.
- Added local 60-second and 5-minute dae0 traffic trend charts calculated from 2-second sysfs counter deltas; chart history exists only while the Runtime page remains open.
- Added a recent-log health summary that counts explicit WARN/WARNING and ERROR/FATAL/PANIC markers in the latest 250 dae log lines without replacing the full Logs page.
- Overview now shows Native API availability and a compact runtime generation snapshot, refreshed independently from local service status.
- Source node/subscription cards can correlate exact tags with the current Native node inventory, expose backend latency observations and expand subscription runtime members when a safe exact provider/subscription tag match exists.
- Policy Groups now includes a visual staged group builder with exact source node tags, optional subscription tags, valid fixed(0)/min/min_moving_avg/min_avg10/random policy syntax and the existing diff-preview safety gate.
- Policy cards can correlate exact group names to Native runtime group snapshots and display current TCP/UDP selections and member counts read-only.
- Added a dedicated hidden retained-flow detail route (`flow-detail?id=...`) so flow traces can be reopened or shared within the LuCI session without depending on an open modal.
- Native Flows and Native Connections now expose Open page links for backend-provided flow IDs while retaining the existing Timeline modal; the detail page uses the same generation-safe traffic/DNS rule association logic.
- Version Manager now accepts a trusted local dae executable through a fixed `/tmp/dae-ui-dae-upload.bin` upload path; backend import rejects symlinks/non-regular files, enforces a 1 KiB–128 MiB size bound, calculates SHA256, executes a version smoke test and validates the active service configuration before creating an immutable custom slot.
- Installed version rows now report source metadata so package/system, official release and custom-upload slots are distinguishable without inspecting the filesystem.
- GeoData pin metadata can now be refreshed from the fixed dae upstream `main/scripts/fetch-geo-data.sh` source. Only numeric release versions and 64-hex SHA256 values are accepted and persisted under `/etc/dae-ui/geodata-pins`; downloads still use fixed v2fly release repositories and SHA256 verification.
- Added protocol-aware staged node/subscription forms. Complex protocols validate their URI scheme, while the simple builder can generate documented HTTP(S), SOCKS4 and SOCKS5 URIs; staged writes keep the existing diff/validate/apply safety model.
- Node and subscription summary cards now redact URI credentials, opaque VMess/SS/SSR payloads and subscription path/query secrets while leaving the user-owned source configuration unchanged.
- CI now checks the write-ACL/frontend/backend contract for custom binary import and GeoData pin refresh, enforces the fixed custom-upload path and verifies the hidden retained-flow route contract.

## 0.13.0 - 2026-09-29

- Added a persistent DAE Version Manager page for installing and selecting multiple dae binaries without changing `.dae` configuration files.
- Added fixed-path managed binary slots under `/usr/lib/dae-ui/versions`; release slots include the verified archive digest so an updated nightly/stable asset cannot overwrite a selected or last-good binary in place.
- Added on-demand official release discovery from `daeuniverse/dae`, filtered to release assets matching the router architecture.
- x86_64 exposes upstream v1, v2/SSE and v3/AVX2 assets; every downloaded binary must pass an execution smoke test before installation.
- Release archives require SHA256 verification from fresh GitHub release asset metadata or the official `.dgst` file before extraction.
- A candidate binary must validate the actual `/etc/config/dae` service configuration before installation and again before activation.
- Downloading does not activate a release. Activation is an explicit separate action.
- Activate & Restart persists the selected slot, restarts dae, verifies the running `/proc/<pid>/exe`, and only then marks the slot last-good.
- Failed runtime activation automatically rolls selection back and restarts the previous last-good/system slot.
- Added a stable `/usr/bin/dae` managed runner while leaving the upstream `/etc/init.d/dae` file unchanged.
- Added `/etc/init.d/dae-ui-version` with START=98 so boot validation/fallback happens before the upstream dae START=99 service.
- Boot selection tries persisted selected → last-good → captured system binary while leaving configuration content untouched.
- The original package-managed dae is captured into a protected system slot before first takeover.
- If a later dae package upgrade overwrites `/usr/bin/dae`, boot repair captures the new package binary, preserves the previous system binary as an immutable `system-prev-*` slot, then reinstalls the runner.
- When version management is enabled, backend validate/reload calls use the selected slot directly; Start/Restart repairs the runner before invoking the normal dae init script.
- Overview now shows Version Manager state, selected slot, last-good slot and the actual running binary.
- Added shell syntax checks to CI for init/libexec helpers.
- Package install ensures version-manager helpers are executable and adds `unzip`/CA dependencies for verified official release downloads.
- Package removal restores the captured system binary to `/usr/bin/dae` when the managed runner still owns that path.

## 0.12.0 - 2026-09-29

- Added the fixed read-only Native API resource `GET /api/v1/dns/rules` and `dns_rules` capability discovery.
- Added a hidden capability-driven Native DNS Rule Dictionary page with separate request and response rule lists, search, filtering, sorting and source metadata.
- DNS request rules expose upstream/asis/reject actions; DNS response rules expose accept/reject/requery actions and resolved upstream names where applicable.
- DNS rule source links use source_id joined through the Native config snapshot and become clickable only when the mapped path exactly matches a locally discovered `.dae` file.
- Native DNS Rules accepts generation-qualified list/rule links and refuses cross-generation associations or rules missing from the requested request/response list.
- Runtime and Native API Discovery now expose DNS rule capability and a Native DNS Rules entry only when reported available.
- Retained Flow Timeline now uses the correct dictionary per route chain: traffic and dns_upstream use traffic rules; dns_request and dns_response use the DNS rule dictionary.
- Both the selected route rule and every retained rule-evaluation row use generation-safe dictionary links; no rule ID alone is treated as sufficient identity.
- Route timeline fields now include DNS action, and DNS evidence exposes route_evaluation_ids for correlating recorded lookups with retained routing evaluations.
- Flow and Connection timeline loaders fetch DNS rules only when the backend explicitly advertises dns_rules; traffic and DNS dictionary failures are reported independently without hiding the retained trace itself.
- No DNS rule mutation, arbitrary config write, cache mutation or general-purpose Native API path was introduced.

## 0.11.0 - 2026-09-29

- Added a reusable retained-flow trace renderer shared by the Flows and Connections pages.
- Native Flows now exposes a Timeline action that reads the exact retained flow detail and renders its causal steps in sequence order.
- Timeline covers input, route, datapath, dial mode, DNS, reroute, outbound and connection stages with observed time, elapsed microseconds, generation ID and evidence provenance.
- Route steps render retained rule evaluations; outbound steps render retained group/member selection candidates including eligibility, sorting latency, score, selected state and reason when present.
- Partial or disabled traces keep their trace status and missing-evidence reasons visible; the UI does not imply omitted evidence was observed.
- Every timeline step and the complete flow detail retain a raw JSON disclosure for low-level diagnosis.
- Traffic-rule links inside the timeline are generated only when the recorded route-step generation exactly matches the current complete rule dictionary and the rule ID exists in that dictionary.
- Native Connections now exposes Timeline only for rows carrying a backend-provided flow_id and opens that exact retained flow; the UI never fabricates a flow identity for unrecorded connections.
- Connection-launched and Flow-launched timelines use the same generation-safe rule/source drill-down logic.
- No flow simulation, connection mutation, rule mutation or arbitrary Native API path was introduced.

## 0.10.0 - 2026-09-29

- Native API status now parses and exposes the advertised probe targets, kinds, purposes, transports, IP versions and job limits.
- Node Probe is capability-driven instead of fixed to one request: the UI offers only advertised probe kinds/transports/IP families, while rpcd independently revalidates the same constraints before submission.
- tcp_connect and HTTP probes are restricted to TCP; DNS probes use the selected advertised transport and the purpose is derived server-side from the probe kind.
- Added safe fixed-path reads for individual group and retained flow details.
- Added explicit Group Probe support for direct members. The UI reads the group's own probe transport capability and splits direct members into sequential explicit-member batches sized by max_members_per_job and max_results_per_job.
- Group probe batches are submitted one at a time only after the prior operation finishes; partial completed results are preserved if a later batch fails.
- Probe member IDs are validated by exact membership in the just-read group detail rather than by URL-path syntax.
- Added generation-safe Flow → Rule resolution. A flow summary rule ID is joined only after retained flow detail proves a traffic route step with the same rule ID and a generation matching the current complete rule dictionary.
- Missing retained route evidence, stale generations and absent dictionary rules are surfaced as non-links rather than guessed associations.
- Native Rules accepts generation-qualified links and refuses to present them as resolved when the requested generation differs from the currently loaded dictionary.
- Native API Discovery now displays probe contract fields and principal job-size limits.
- No arbitrary probe body, arbitrary operation URL, group selection, connection closing, DNS cache mutation or general-purpose Native API write proxy was added.

## 0.9.0 - 2026-09-29

- Added read-only Native routing rule dictionary support through the fixed GET `/api/v1/rules` resource.
- Added Native config read support only for source-ID mapping used by the rule dictionary.
- Rule source navigation follows the contract: join `source_id` to Native config sources first, then link to the local editor only when the resulting relative path exactly matches a locally discovered `.dae` file; the redacted/display-only rule `file` field is never used as a file-access path.
- Added capability reporting for `config`, `rules` and `operations`.
- Added a hidden capability-driven Native Rules page with search, filtering, sorting, generation ID and fallback metadata.
- Added explicit single-node TCP connect probes when both `probes` and `operations` capabilities are available.
- Node probes never run automatically: each request requires a button click and confirmation.
- rpcd constructs a fixed node-target `tcp_connect` probe request; callers cannot provide arbitrary probe JSON or arbitrary operation URLs.
- Added safe operation polling restricted to returned operation IDs, with Retry-After-aware polling and a 60-second UI timeout.
- Probe results expose backend-reported health state, latency, resolved leaf node, transport/IP version, health update status and errors.
- No group-selection mutation, connection closing, DNS cache mutation, config mutation or general-purpose Native API POST proxy was added.

## 0.8.0 - 2026-09-29

- Added snapshot-safe incremental Native API cursor loading for Nodes, Flows, DNS cache and DNS log.
- First-page polling remains live until another server page is loaded; loading a cursor freezes that dataset snapshot and exposes an explicit Restart live snapshot action.
- Cursor walks retain at most 5000 rows locally and report 400/410 invalid or expired cursors instead of silently joining a new snapshot.
- Added validation diagnostic parsing for safe `.dae:line:column` locations.
- Configuration-file links can now select the exact `.dae` file and scroll CodeMirror to a reported validation line.
- Main Config, managed-section saves and Diagnostics show clickable validation diagnostics when dae reports source coordinates.
- Config Sources, All Sections and structured existing-section views now link source labels to the multi-file editor.
- Added capability-gated Native Diagnostics route.
- Added read-only diagnostic DNS Query using the contract's GET `/api/v1/dns/query` with domain/type/upstream/cache-mode request preview.
- Added bounded Routing Trace simulation using only POST `/api/v1/routing/trace`; the backend builds the request from whitelisted fields and does not accept arbitrary URLs or JSON bodies.
- Routing Trace renders routing evaluations, rule evaluations and simulation DNS evidence while explicitly treating the response as hypothetical simulation data.
- No connection close, policy mutation, DNS cache mutation, arbitrary Native API POST or raw config mutation was added.

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
