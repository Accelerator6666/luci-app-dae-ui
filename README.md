# luci-app-dae-ui

A modern LuCI management UI for **dae**, designed from three references without cloning any one of them:

- `QiuSimons/luci-app-honk`: OpenWrt package layout, rpcd/Ucode patterns, service lifecycle integration.
- `Zakkaus/doona`: information architecture and UX ideas such as activity/status, connections, DNS, policies, routing, nodes, config and logs.
- Doona docs/API contract: a capability-driven model for future dae native API integration.

## Design principle

This package must be useful **today** with normal dae installations. It therefore manages what dae already exposes locally: process state, config files, `dae validate`, `dae reload`, logs and system diagnostics. It does **not** fabricate Doona resources that dae does not currently expose.

When dae implements the shared daeuniverse native API contract, the Native API page becomes the integration point for connections, DNS telemetry, policy selection, route traces, activity history and other runtime resources.

## v0.2.0

- Live Overview with process, memory, version, config validation, discovered config-file count and eBPF interface state.
- Start / stop / restart / hot reload / suspend controls.
- Local CodeMirror DAE editor with line numbers, DAE syntax highlighting, bracket matching, auto-close and folding.
- Include-aware multi-file configuration manager for `.dae` files under the active config directory.
- Safe configuration writes:
  - timestamped backup before write;
  - `dae validate` before acceptance;
  - hot reload after apply;
  - automatic rollback when validation or reload fails.
- Dedicated read-only Nodes, Policies, Routing and DNS views with source-file attribution.
- All Sections view for `global`, `subscription`, `node`, `group`, `routing`, `dns`, `experimental` blocks across discovered `.dae` files.
- Backup history with per-file diff, restore+validate and restore+reload.
- Diagnostics page for process, validation, `dae0` and default route.
- Live log page with refresh, pause and clear.
- Native API readiness page, deliberately capability-driven.
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

## Planned v0.3

- Editable structured Nodes / Policies / Routing / DNS forms with staged changes and one atomic apply.
- Geodata status/update helpers.
- Better parser diagnostics and source navigation.
- Native API capability discovery and optional Doona-style runtime pages when dae exposes the required contract.

## License

GPL-3.0-only.
