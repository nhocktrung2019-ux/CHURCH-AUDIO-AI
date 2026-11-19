# CHURCH AUDIO AI — v0.56–v0.100 staged roadmap

This roadmap describes later engineering increments. Items below are planned, not claimed as implemented by the v0.51–v0.55 branch.

| Versions | Scope | Required evidence / acceptance |
|---|---|---|
| v0.56–v0.60 | Impulse response capture, RT60/EDT/T20/T30, decay-fit diagnostics, noise-floor checks | Valid impulse response, correct decay windows, sufficient dynamic range; withhold results when noise floor or decay range is inadequate |
| v0.61–v0.65 | Feedback-risk monitoring, narrowband persistence, alert history, false-positive controls | Alert-only; verify stable tones and operator context; no automatic notch/mute |
| v0.66–v0.70 | Speaker/microphone catalogue, manufacturer response and polar data, provenance and confidence | Only verified datasheets or measured files; store source, revision, units and date; unknown values remain unknown |
| v0.71–v0.75 | Multi-zone spatial optimization, coverage overlap, listening-point weighting, measured-vs-simulated 3D review | Preserve current 3D scene and saved coordinates; keep simulation separate from measured results |
| v0.76–v0.80 | Mixer/DSP model registry, firmware capability matrix, LAN discovery and read-only protocol adapters | Exact device identity, official protocol reference, authenticated session, read-back and timeout handling |
| v0.81–v0.85 | Controlled DSP proposal workflow, parameter preview, snapshot, rollback and approval | Model-specific adapter tests, audit log, explicit technician approval; default read-only |
| v0.86–v0.90 | Android offline-first sessions, USB audio routing, lifecycle recovery, performance and accessibility | Physical device tests for permissions, USB host support, route changes, interruptions, storage and WebGL |
| v0.91–v0.95 | Complete Vietnamese/English UI, project templates, audit trails, import/export schema validation | Translation coverage, schema migrations, round-trip tests and no silent data loss |
| v0.96–v0.100 | Full integration, regression hardening, signed Android APK, Windows packaging and release guides | Reproducible CI, signing secrets supplied by owner, clean install/upgrade, release checksums and field acceptance |

## Cross-version safety gates

1. dBFS, relative frequency-response dB and dB SPL remain distinct measurement domains.
2. No simulated or theoretical values enter measured datasets.
3. RT60 is withheld unless impulse-response quality, noise floor and decay-fit criteria are satisfied.
4. Feedback detection starts as operator alerts, not automatic processing.
5. Manufacturer response/polar curves require traceable sources.
6. LAN control requires exact mixer/DSP model and firmware plus documented protocol. No guessed register maps.
7. Any future write capability requires preview, backup, rollback, explicit approval and a separate device-specific safety review.
8. Existing 3D scene, speaker positions, room geometry and saved SPL records remain backward compatible.
9. Android release is not considered complete until physical-device tests pass; no release artifact is claimed by roadmap documentation.
