# v1.03 / v1.03.1 — Room-linked measured SPL points

## Purpose

Attach physical SPL observations to stable coordinates in the existing church room model. The original Three.js church scene, speaker positions, furniture, camera state and legacy SPL zone records remain intact.

## Record contract

Each saved point has a stable ID, label, X/Y/Z coordinates in metres, SPL value in dB SPL, calibration state, A/C/Z weighting, operator-entered input/microphone label, note and capture timestamp. Records are stored separately under `church-audio-measured-points-v103`.

## Measurement integrity

- Only finite coordinates inside the current room dimensions are plotted in either view.
- A point is counted as verified only when it is in bounds, has a finite SPL value in the supported range and is explicitly marked calibrated by the operator.
- Calibration is operator-supplied provenance; the app does not independently verify the calibrator or microphone chain.
- dBFS, simulated values and theoretical predictions are not converted into or admitted as measured dB SPL.
- A/C/Z weighting is retained per point; mixed weighting must not be pooled into one uniformity statistic.
- Resizing the room does not rewrite saved coordinates. Out-of-bounds records remain stored for review but are hidden from both visualizations.

## v1.03 — Floor-plan workflow

The design workspace provides a room-linked floor-plan map and manual point-entry form. The default X/Y location is initialized from the saved reference listening point; microphone height defaults to 1.2 m. Operators can enter SPL, calibration state, weighting, input label and notes, then save or remove records.

## v1.03.1 — Three.js WebGL overlay

The existing Three.js church scene reads the same saved records as the floor-plan panel. In-bounds points render at their saved X/Y/Z coordinates (mapped to Three.js world X/Z/Y) as glowing markers with a floor ring, vertical locator stem and camera-facing label. Labels show the point name and SPL/weighting when available.

Explicitly calibrated points use measured-level color bands; uncalibrated or incomplete points remain amber and are labelled unverified. Color bands are visual cues only, not exposure, safety or compliance thresholds. A persistent visibility toggle hides or shows the marker layer without deleting records. Measurement markers cannot be dragged or selected as speakers/furniture. Marker geometry, materials, line resources and label textures are disposed when updated or when the scene is torn down.

## Not included

- Live microphone capture directly into a selected point.
- Automatic input-device identity verification.
- Validated interpolation into a continuous SPL heatmap.
- Automatic DSP, mixer or speaker-setting writes.

A future measured heatmap must define minimum point density, weighting compatibility, calibration provenance and spatial interpolation rules, with regression coverage before it is used for technical decisions.

## Validation

Run:

```bash
npm test
npm run build
```

Physical Android validation remains required for touch interaction, persistence across app restarts and field-measurement workflow. This feature is a survey aid, not an IEC 61672-certified sound level meter.
