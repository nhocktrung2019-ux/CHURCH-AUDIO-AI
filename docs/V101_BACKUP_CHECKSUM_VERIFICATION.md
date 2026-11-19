# v1.01 — Backup checksum verification

- New exports use schema v2 with SHA-256 over sorted project key/value entries.
- Imports continue to accept schema v1 backups from v1.00, clearly labeled legacy/unverified before restore.
- Schema v2 imports must pass checksum verification before any localStorage write.
- SHA-256 detects accidental corruption or modification; it is not a digital signature or sender authentication.
- Web Crypto is required. If unavailable, export/verification fails safely.
- Existing key, entry and size limits, confirmation and rollback behavior remain.
