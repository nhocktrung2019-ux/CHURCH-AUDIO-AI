# CHURCH AUDIO AI — v0.81–v0.85 spatial SPL analysis

## Delivered
- **v0.81 — 3D measured overlay:** the existing measured-zone heatmap is passed to the existing WebGL room scene as a translucent floor overlay only when the selected zone has calibrated dB SPL data. Saved room geometry, speaker coordinates, furniture and camera controls are unchanged. Cells outside the interpolation radius or without enough neighbours remain absent.
- **v0.82 — paired-zone comparison:** compare two selected zones only at matching listening-position labels. Input identity, dB SPL units and calibration offset must agree.
- **v0.83 — seat-row uniformity:** repeated captures at each labelled position are duration-weighted energy-averaged before row mean, spread and standard deviation are calculated.
- **v0.84 — empirical distance trend:** regression of measured level against log10(distance) uses coordinate-matched positions in the selected speaker zone. This is a descriptive room measurement, not a free-field prediction.
- **v0.85 — capped gain starting point:** produces a maximum ±3 dB technician-review suggestion only when at least three matching positions are present. The output is explicitly read-only.

## Data and interpretation limits
The legacy zone measurement schema stores zone, position label, coordinates, level, unit, duration, input label and calibration offset. It does not store an independent calibration profile ID or a left/right channel identity. For this increment, L/R comparison is therefore implemented as a manually selected pair of named zones, not automatic channel recognition.

Only calibrated dB SPL records from one matching input label and calibration offset are accepted. Pair comparison matches position labels, so the labels must describe equivalent listening locations. Distance regression requires at least three distinct coordinate-matched positions and uses an assumed ear height (default 1.2 m). Room reflections, directivity, multiple sources, occlusion, phase and DSP processing affect the observed trend.

## Safety / compatibility
- No measured record is edited, deleted or reclassified.
- No 3D room dimensions, furniture, speaker placement, zone assignment or camera state is migrated.
- No speaker prediction is presented as a measured value.
- Gain suggestions are capped and advisory only. No DSP, mixer, network or LAN command is sent.
- Delay remains geometry-only unless separately verified with impulse-response/loopback measurements.

## Validation
Regression tests cover matched-zone comparison, input/calibration mismatch, row aggregation, coordinate requirements, empirical regression and capped read-only gain advisory. Run \`npm test\` and \`npm run build\` in CI; physical validation requires a calibrated measurement microphone and controlled repeatable field captures.
