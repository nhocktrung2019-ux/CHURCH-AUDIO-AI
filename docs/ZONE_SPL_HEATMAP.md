# Zone SPL spatial heatmap — v0.35

## Purpose
Convert measured zone SPL survey points into a conservative 2D room heatmap for later overlay in the existing Three.js room planner.

## Data contract
Each measured point must include manually verified room coordinates in metres (xM, yM), a named listening position, zone, level, unit, input identity and capture duration. The current capture form does not infer coordinates from a seat label. Coordinates must be explicitly surveyed and entered before visualisation.

## Interpolation
- Repeated captures at the same named coordinate are duration-weighted in linear energy.
- Interpolation uses inverse-distance-squared weighting in the linear-energy domain.
- A configurable radius bounds interpolation; cells outside it remain blank.
- Cells with fewer than the configured number of neighbouring positions remain blank.
- Exact measured coordinates are marked as measured, not interpolated.

## Measurement integrity
- One heatmap is generated for one zone at a time.
- Mixed input identities or units are rejected.
- dB SPL requires a consistent calibration offset across all selected records.
- dBFS remains relative digital level and must not be labelled dB SPL.
- The map is a survey visualisation, not a predictive acoustic model, certified sound-level map, IEC 61672 result or proof of uniform coverage.
- This module does not control DSP gain, mute, EQ, delay or output routing.

## Follow-up integration
The next UI increment must add explicit X/Y coordinate entry in metres to each survey capture and overlay measured/interpolated cells in the existing 3D room floor. Keep the 3D room model and speaker placement intact.
