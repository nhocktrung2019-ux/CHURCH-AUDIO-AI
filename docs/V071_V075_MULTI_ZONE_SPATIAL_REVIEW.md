# CHURCH AUDIO AI — v0.71–v0.75 Multi-zone spatial review

## Scope
- **v0.71 — Spatial listening-point weighting:** validates named listening points, room bounds and explicit positive weights. Weight is a survey priority, not a claim about acoustic energy.
- **v0.72 — Weighted multi-zone measurement summary:** summarizes only accepted, calibrated dB SPL measurements from one matching input chain and calibration identity/offset. Repeated captures at a point are energy-averaged before spatial weighting.
- **v0.73 — Measured versus simulated separation:** keeps measured, simulated and theoretical records in separate collections. Simulation/theory never enters measured zone summaries.
- **v0.74 — 3D placement review:** checks saved speaker coordinates against room bounds and reports nearest-speaker geometric references for listening points. It does not calculate acoustic coverage, change coordinates or infer a measured result.
- **v0.75 — Optimization review queue:** identifies missing captures and measured zone-balance review priorities. It emits no gain, delay, EQ or DSP command; `writeEnabled: false`.

## Measurement and compatibility rules
- dBFS is not accepted by the calibrated SPL optimizer.
- A single summary requires one non-empty input label, one calibration ID and one consistent finite calibration offset.
- Only accepted measured records contribute. Review/rejected, simulated and theoretical records are excluded.
- Captures must match a saved listening-point ID and be within 0.5 m of its saved coordinate.
- Existing 3D room scene, saved speaker positions, zone assignments, measurement records and calibration keys are not migrated or overwritten.
- Legacy records without coordinates remain preserved but cannot satisfy a coordinate-matched spatial point.

## Validation
Run `npm test` and `npm run build`. The new tests cover weighting validation, measurement compatibility, evidence separation, geometry review and read-only optimization output. Physical microphone calibration, field measurements, actual 3D/WebGL behavior and Android device testing remain separate acceptance requirements.

This increment is a pure analysis engine and regression tests. It is not a claim of measured acoustic optimization or field-ready DSP automation.
