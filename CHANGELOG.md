# Changelog

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
