# Changelog

## Unified architecture v1.01 — integration baseline

- Establish one product architecture spanning the 3D room planner, SPL measurement, room analysis, speaker alignment, advisory Auto EQ/feedback, equipment profiles, DSP networking, assistant and reporting.
- Define canonical domain records and measurement provenance rules so zones, speakers, calibration and analysis results can be shared across modules.
- Specify measured-versus-simulated data separation and quality gates for SPL heatmaps, phase/delay and DSP recommendations.
- Preserve the existing Three.js room planner as the canonical geometry engine.
- Start implementation on the dedicated `integration/unified-v1.01` branch.

- Add shared TypeScript contracts for projects, zones, measurement provenance, calibration references and SPL summaries.
- Add domain validation that prevents dBFS, calibrated SPL, simulated SPL and interpolated SPL from being silently mixed.
- Add Node regression tests for energy averaging, exclusion of simulated data and calibration/unit integrity.

**Validation status:** source and regression-test files committed; tests and application build have not yet been executed in this environment. No APK, Windows package or physical hardware validation is claimed.

## 0.30.0-beta.1 — v0.76 measured SPL zone map

- Add a persistent per-zone SPL measurement worksheet with editable zone names, readings and field notes.
- Show measured coverage count, energy-averaged SPL, minimum/maximum level and min–max spread.
- Classify zones against an operator-defined target and preserve the existing Three.js room planner unchanged.
- Clearly distinguish manually entered calibrated SPL readings from uncalibrated dBFS and simulated coverage estimates.

**Validation status:** source integration committed; automated build and Android packaging have not yet been run in this environment. Field validation with a calibrated measurement microphone is still required.

