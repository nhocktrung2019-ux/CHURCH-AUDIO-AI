# v1.01 — Backup checksum verification

- New exports use schema v2 and include a SHA-256 checksum over sorted project key/value entries.
- Imports continue to accept schema v1 backups created by v1.00, but label them legacy/unverified before restore.
- Schema v2 imports must pass checksum verification before any localStorage write.
- The checksum detects accidental corruption or modification; it is not a digital signature and does not authenticate the source.
- SHA-256 uses Web Crypto. If unavailable, export or verification fails safely; no checksum fallback is fabricated.
- Existing entry/key/size limits, explicit restore confirmation and rollback behavior remain.
