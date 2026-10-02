# luci-app-dae-ui v0.14.0

Release date: 2026-10-02

## Highlights

### Smarter DAE configuration editing

- Context-aware CodeMirror completion with `Ctrl+Space` / `Cmd+Space`.
- Section-aware suggestions for `global`, `group`, `dns` and `routing`.
- Routing matcher and outbound/group completion.
- Inline validation diagnostics in the editor gutter with first-error navigation.

### Runtime observability

- 60-second and 5-minute local dae0 RX/TX traffic trends from kernel counters.
- Current / average / peak rate summaries.
- Native API generation consistency across config / traffic rules / DNS rules.
- Recent WARN / ERROR marker summary from the latest dae log lines.
- Overview now surfaces Native API availability and runtime generation state.

### Nodes, subscriptions and policies

- Source node/subscription cards can correlate exact tags to Native runtime inventory.
- Runtime TCP/UDP latency observations are shown where the backend reports them.
- Subscription cards can expand matched runtime members.
- Policy cards can correlate exact group names to current TCP/UDP runtime selections.
- Visual staged group builder supports exact node tags, subscription tags and common DAE policies.
- Protocol-aware staged node form validates URI schemes.
- Simple HTTP(S), SOCKS4 and SOCKS5 URI builder.
- Summary cards redact credentials and subscription path/query secrets.

### Retained flow deep links

- New hidden `flow-detail?id=<flow_id>` route.
- Native Flows and Native Connections expose `Open page` links.
- Rule links remain generation-safe and are never joined across mismatched generations.

### DAE Version Manager

- Trusted local dae executable upload through a fixed temporary path.
- 1 KiB–128 MiB size bound.
- Rejects symlinks/non-regular uploaded files.
- SHA256-addressed immutable custom slots.
- Version smoke test and active service-config validation before installation.
- Imported binaries are never activated automatically.
- Installed slots show their source type and source metadata.

### GeoData pin refresh

- GeoData pin metadata can be refreshed from the fixed dae upstream file:
  `daeuniverse/dae/main/scripts/fetch-geo-data.sh`.
- Only numeric release versions and 64-hex SHA256 values are accepted.
- Persisted pins are stored under `/etc/dae-ui/geodata-pins`.
- GeoData download URLs remain fixed to the v2fly GeoIP and domain-list-community release repositories.
- Downloaded files are SHA256 verified, existing files are backed up, and replacement is atomic.

## Safety model

v0.14.0 keeps the project’s existing safety boundaries:

- user-owned DAE source is never silently rewritten;
- managed writes remain staged and diffable;
- full configuration validation happens before accepted writes;
- custom binaries are imported but not automatically activated;
- Version Manager keeps selected / last-good / system fallback behavior;
- Native API access remains fixed-path and capability-driven;
- retained flow/rule joins require matching generation IDs;
- GeoData refresh does not use unverified `latest/download` URLs.

## Router-side validation checklist

Test on the target OpenWrt router before treating the release as production-validated:

1. Open **Services → DAE → Configuration Files** and confirm CodeMirror loads normally.
2. Press `Ctrl+Space` inside `routing { }` and verify context suggestions appear.
3. Intentionally stage invalid syntax, run validation, and verify the editor gutter marks the failing line.
4. Open **Runtime** for at least 60 seconds and confirm the dae0 traffic trend updates without browser console errors.
5. Verify Overview and Runtime show sensible Native API generation state for the installed dae build.
6. Confirm Nodes / Subscriptions pages still work when Native API is unavailable.
7. Confirm runtime node/group correlations appear only when exact tags/names exist.
8. Stage a Policy Group, use **Preview diff**, then cancel without writing.
9. Open a retained flow through **Open page**, refresh the browser, and verify the same flow ID remains in the URL.
10. On **DAE Versions**, upload a trusted matching dae binary and verify it installs as an inactive custom slot.
11. Confirm importing an incompatible binary fails validation without changing the selected slot.
12. Refresh GeoData pins, inspect the reported source/fetched time, then run the verified GeoData update.
13. Reboot and verify the selected dae slot persists and the service still starts from the intended binary.

## Compatibility note

The UI continues to prefer capability detection over assumptions. Native-only features stay unavailable when the installed dae/daemon does not advertise the corresponding API resource.
