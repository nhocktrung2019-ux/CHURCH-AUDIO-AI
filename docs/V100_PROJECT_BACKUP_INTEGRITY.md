# v1.00 — Project backup integrity

## Scope
- Validate the entire JSON backup before writing to local storage.
- Enforce the Church Audio format and schema version, timestamp validity, project-key namespace, string-only values, 2,000-entry ceiling, 5 MB per value and 20 MB total payload.
- Ask for confirmation before restoring because restore overwrites matching project keys.
- Keep a snapshot of affected keys and roll back writes if local storage rejects a restore partway through.
- Preserve the existing local backup format (schema version 1), 3D room, speaker positions and measurement records.

## Safety
- Import does not execute file content; values remain strings in localStorage.
- Keys outside the `church-audio-` namespace are rejected, not silently imported.
- A restore remains a local merge: keys absent from the backup are not deleted.
- Exported backup excludes raw audio recordings and remains the user's responsibility to store safely.
- Limits are guardrails for browser memory/storage, not a guarantee that every Android device has 20 MB available.

## Validation
Regression tests cover valid backups, wrong format/schema, malformed timestamps, foreign keys, invalid value types, empty payloads and size/count limits.
