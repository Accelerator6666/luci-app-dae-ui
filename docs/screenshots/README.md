# README screenshot plan

This directory contains one explicitly labeled UI design preview plus reserved filenames for **real OpenWrt router screenshots**.

- `overview-preview.svg` is a synthetic layout preview with sample data. It may be shown in the public README only when clearly labeled as a preview.
- `overview-zh-cn.png`, `runtime-zh-cn.png`, `versions-zh-cn.png`, and `configuration-zh-cn.png` remain reserved for real v0.14.2 router captures.
- Never present generated/sample data as live router telemetry.

## Required captures

1. `overview-zh-cn.png`
   - LuCI language: Simplified Chinese
   - Page: Services → DAE → Overview
   - Show service state, selected version, validation, dae0 and Native API status
   - Prefer a normal running state

2. `runtime-zh-cn.png`
   - LuCI language: Simplified Chinese
   - Page: Services → DAE → Runtime
   - Keep the page open long enough to populate the 60-second traffic chart
   - Include CPU / memory / RX / TX summaries and Native generation panel

3. `versions-zh-cn.png`
   - LuCI language: Simplified Chinese
   - Page: Services → DAE → DAE Versions
   - Show selected, last-good, running binary and installed slots
   - Do not expose local upload filenames that contain personal information

4. `configuration-zh-cn.png`
   - LuCI language: Simplified Chinese
   - Page: Services → DAE → Configuration Files
   - Show CodeMirror, DAE syntax highlighting and validation state
   - Use a sanitized configuration; redact node URLs, UUIDs, passwords, tokens and subscription URLs

## Capture rules

- Use real router output from the v0.14.2 build.
- Prefer 16:9 or a wide desktop browser viewport.
- Keep the LuCI theme consistent across screenshots.
- Avoid browser extensions or unrelated UI overlays.
- Redact public IP addresses, private hostnames, UUIDs, credentials, API tokens, subscription URLs and other secrets.
- Do not redact generic RFC1918 addresses unless they identify a sensitive environment.
- Do not include Native API Bearer tokens.
- Do not include raw node share links.
- Keep screenshots readable at GitHub README width.

## README insertion order

Recommended order:

```text
Overview
Runtime
DAE Version Manager
Configuration Editor
```

The English and Simplified Chinese README files already contain commented screenshot placeholders. Replace those comments with normal Markdown image links after real-router validation.
