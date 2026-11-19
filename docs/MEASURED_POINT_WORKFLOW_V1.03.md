# v1.03 — Room-linked measured-point workflow

## Purpose

Attach physical SPL observations to stable coordinates in the existing church room model without replacing the current Three.js scene or changing speaker placement.

## Record contract

Each saved point has:
- Stable point ID and human-readable label.
- X/Y/Z coordinates in metres, bounded by the saved room length, width and height.
- SPL value in dB SPL, calibration state, and A/C/Z weighting.
- Operator-entered input/microphone label, note and capture timestamp.

The record is stored separately under `church-audio-measured-points-v103`. Existing room dimensions and reference listening coordinates are read from the current room-planner keys. Existing SPL zone records are not migrated, overwritten or silently assigned coordinates.

## Measurement integrity

- A point is plotted only when its coordinates are finite and within the current room bounds.
- A point is counted as verified only when it is in bounds, contains a finite SPL value in the supported input range, and is explicitly marked calibrated by the operator.
- Calibration state is provenance supplied by the operator; this UI does not independently verify a calibrator or microphone chain.
- dBFS, simulated values and theoretical predictions are not converted into or admitted as measured dB SPL.
- A/C/Z weighting is retained per point. Mixed weighting data must not be pooled into one uniformity statistic.
- Moving/resizing the room does not rewrite saved coordinates. Out-of-bounds points remain stored for review but are hidden from the map and excluded from verified counts.

## Current UI behavior

The design workspace now includes a room-linked floor-plan map and manual point-entry form. The default X/Y location is initialized from the existing reference listening point, with microphone height defaulted to 1.2 m. Operators can enter the measured level, calibration state, weighting, input label and notes, then save or remove individual records.

## Not included in v1.03

- Live microphone capture directly into a selected point.
- Automatic input-device identity verification.
- Automatic interpolation between measured points into a continuous SPL heatmap.
- Automatic DSP, mixer or speaker-setting writes.

## v1.03.1 — Three.js measured-point overlay

The existing Three.js church scene now reads the same `church-audio-measured-points-v103` records used by the floor-plan panel. In-bounds records are rendered at their saved X/Y/Z coordinates (world axes X/Z/Y), with a glowing measurement marker, floor ring, vertical locator stem and camera-facing label. The label includes the point name and SPL/weighting when a value exists. Explicitly calibrated records use the measured-level color bands; uncalibrated or incomplete records remain amber and are labelled as unverified. These colors are display cues only and are not exposure or compliance thresholds.

A persistent visibility toggle hides or shows the point layer without deleting measurements. Out-of-bounds records remain saved but are not sent to the 3D scene. Measurement markers do not participate in speaker/furniture dragging or selection. The renderer disposes marker geometry, materials and label textures when records change or the scene is torn down.

## Not included in v1.03.1

- Live microphone capture directly into a selected point.
- Automatic input-device identity verification.
- Validated SPL heatmap interpolation between measured points.
- Automatic DSP, mixer or speaker-setting writes.
- Heatmap interpolation or SPL predictions from unmeasured positions.
- Automatic DSP, mixer or speaker-setting writes.

These are separate gated increments. v1.04 should only derive a measured heatmap after point density, weighting compatibility, calibration provenance and spatial interpolation rules have explicit validation and regression coverage.

## Validation

Run:

```bash
npm test
npm run build
```

Physical Android validation is still required for touch layout, persistence across app restarts and field-measurement workflow. This feature is a survey aid, not an IEC 61672-certified sound level meter.
