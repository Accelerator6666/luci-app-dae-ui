# luci-app-dae-ui v0.14.2

## DAE archive import

v0.14.2 extends DAE Version Manager so a user can import a trusted dae build without manually extracting it on another machine first.

Supported local inputs:

- raw `dae` executable
- `.zip`
- `.tar.gz`
- `.tgz`

The LuCI page now provides a drag-and-drop / click-to-select upload area.

## Import pipeline

```text
local file
   ↓
fixed LuCI upload path
/tmp/dae-ui-dae-upload.bin
   ↓
archive inspection (if needed)
   ↓
exactly one dae / dae-* payload
   ↓
bounded extraction to a private temporary file
   ↓
binary SHA256
   ↓
dae --version smoke test
   ↓
validate active OpenWrt dae service config
   ↓
immutable version slot
```

Archive imports also report the SHA256 of the uploaded archive separately from the SHA256 of the extracted dae binary.

## Safety properties

- rpcd never accepts an arbitrary server-side upload path.
- Archive member paths are checked before extraction.
- Archives with more than 500 listed entries are rejected.
- An archive must expose exactly one `dae` or `dae-*` executable payload.
- The archive directory tree is never extracted.
- Only the selected payload is streamed to a private temporary file.
- Extracted output is capped at 128 MiB.
- The extracted or raw binary must execute successfully.
- The binary must validate the active dae service configuration.
- Import does not activate or restart dae automatically.
- The selected version still uses the existing `selected → last-good → system` reboot fallback model.

## Trust model

Manual upload is intentionally trust-based.

The UI does not treat a local file as an official dae release merely because its filename matches an official release asset. Official online installs continue to use the separate verified-release path with GitHub / `.dgst` SHA256 verification.
