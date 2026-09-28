# Changelog

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
