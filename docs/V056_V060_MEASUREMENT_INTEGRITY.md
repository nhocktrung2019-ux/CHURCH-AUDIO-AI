# v0.56–v0.60 — measurement integrity hardening

## v0.56 — unique capture identity
- Reject duplicate or non-finite sweep IDs before repeatability analysis.
- Prevent duplicated records from being counted as independent repeat measurements.
- Keep raw sweep records unchanged; blocked datasets cannot generate zone response curves.

## v0.57 — validated quality thresholds
- Validate the repeat-count threshold as an integer from 2 through 20.
- Validate coherence threshold in the inclusive 0–1 range.
- Invalid configuration blocks the quality assessment instead of silently producing a misleading "ready" state.

## v0.58 — malformed metadata resilience
- Runtime metadata checks safely reject missing/non-string zone and listening-position labels.
- Malformed input is reported as a blocked dataset rather than throwing during validation.

## v0.59–v0.60 — acceptance and field verification
- Run focused tests, complete Node regression suite and TypeScript/Vite build.
- Validate three or more repeat sweeps per position using a fixed gain/input chain.
- Compare results with a calibrated reference analyser and retain raw capture provenance.
- Keep relative-response dB distinct from calibrated SPL; no automatic DSP writes are enabled.

## Validation boundary
These changes strengthen software data validation only. They do not prove microphone calibration, ADC/DAC linearity, common hardware clock, physical input routing or agreement with a reference analyser. Android hardware and acoustic validation remain separate acceptance gates.
