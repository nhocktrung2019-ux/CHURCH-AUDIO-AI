# CHURCH AUDIO AI — v0.76–v0.80 Measurement confidence

## Scope
- **v0.76 — Repeatability:** calculate capture count, min/max and spread for each zone/listening point. The default 1.5 dB limit is configurable and is a review threshold, not a universal acoustic standard.
- **v0.77 — Robust outlier screening:** median/MAD screening flags unusual repeated captures for technician review. Records are never deleted, rewritten or silently excluded.
- **v0.78 — Spatial coverage:** report expected versus captured listening points per zone.
- **v0.79 — Confidence classification:** combine coverage and repeatability into high/medium/low review confidence, with explicit reasons.
- **v0.80 — Safety and audit boundary:** outputs are read-only analysis; no SPL correction, gain/delay/EQ calculation, DSP write or LAN command is generated.

## Data integrity
Only accepted, measured, calibrated dB SPL records are eligible. Records must match saved listening-point IDs and be within 0.5 m of saved coordinates. A result requires one consistent input label, calibration ID and finite calibration offset. dBFS, simulated/theoretical evidence, rejected/review records, mixed calibration chains and coordinate mismatches are excluded.

Outlier flags are advisory only. They do not prove a microphone fault or bad measurement; a technician must inspect the capture context before taking action. Confidence is a data-completeness/repeatability indicator, not an acoustic certification or guarantee of uniform coverage.

## Compatibility
No changes to RoomPlanner3D, ChurchSceneWebGL, room geometry, speaker coordinates, zone assignments, existing records, calibration keys or DSP/LAN behavior.

## Validation
Run `npm test` and `npm run build`. Regression tests cover calibration-chain isolation, repeatability, MAD outlier flags, immutable source records, coverage confidence and invalid thresholds. Field validation still requires a calibrated measurement microphone and repeatable on-site captures.
