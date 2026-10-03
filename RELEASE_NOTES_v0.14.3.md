# luci-app-dae-ui v0.14.3

v0.14.3 is a stability and safe-editing release built on the v0.14.2 DAE Version Manager and archive-import baseline.

## Highlights

- Visibility-aware live polling: background LuCI tabs no longer keep hitting local rpcd and Native API resources on the normal live cadence.
- Syntax-aware group parsing: quoted apostrophes, `#` inside quoted values, regex text and multiple group filters are preserved as DAE/honk syntax.
- Field-level staged edits for tagged managed nodes, subscriptions and group policy/filter values.
- Optimistic revision protection for managed writes: a stale browser page cannot silently overwrite a newer managed file.
- Copy Error and Recent Error Diagnostics with a 20-record, sanitized history scoped to the current browser-tab session.
- Complete Simplified Chinese strings for the new UI.

## Safety model

Field controls edit the staged managed body only. Existing Preview Diff, dae validation, backup/rollback and optional hot reload remain the write path.

Managed saves carry the SHA256 revision observed when the page loaded. If the on-disk managed file changed meanwhile, rpcd rejects the stale write and returns the current body. The UI keeps the user's staged body available for copying instead of attempting an automatic merge.

Group filters are treated as opaque DAE/honk expressions. Field mode does not reinterpret regexes or quoted values and refuses to add/remove filter lines; structural changes remain available in the raw managed editor and still pass through full dae validation.

Recent error history is kept only in session-scoped browser storage for the current tab so it survives LuCI page navigation but disappears with the tab session. RPC arguments, authentication tokens, secrets and request bodies are not recorded.

## Validation focus

Before release, verify on a real OpenWrt 25.12 x86_64 router:

1. Hidden-tab polling stops and resumes normally.
2. Node/subscription URI field edits preserve comments and unrelated entries.
3. Group filters containing apostrophes, quoted `#` characters and regex syntax round-trip unchanged.
4. A concurrent managed-file edit triggers the revision-conflict dialog and is never overwritten.
5. Copy Error and Recent Error Diagnostics work in both secure-context clipboard mode and the fallback copy path.
6. Simplified Chinese rendering remains complete.
