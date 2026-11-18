# v0.35–v0.40 measured zone SPL workflow

This increment is stacked on the v0.35 measured heatmap engine and preserves the existing Three.js church room planner, room dimensions, speaker positions, zones and scene objects.

## v0.36 — surveyed coordinates
- Zone SPL captures accept optional X/Y coordinates in metres.
- Coordinates are explicitly entered from a site-surveyed floor plan; seat labels are never converted into guessed coordinates.
- Existing records without coordinates remain valid and visible; they are excluded from spatial heatmaps.
- CSV exports include X/Y columns. Missing coordinates remain blank.

## v0.37 — measured heatmap in the room workflow
- The existing room planner reads the same persistent zone measurement records.
- Measured/interpolated heatmap cells are overlaid on the planner's SVG floor and also shown as a compact grid beside the retained WebGL/Three.js scene.
- Cells outside the configured interpolation radius or without enough neighbouring positions remain blank.
- The heatmap is filtered by selected zone and refuses mixed input identities/units or inconsistent calibration offsets.
- The simulated coverage layer remains distinct from the measured layer.

## v0.38 — uniformity analysis
- Existing per-zone summaries and balance comparison remain available.
- Repeated captures at the same named listening position are energy-averaged before position weighting.
- Comparison requires the same input identity, unit and calibration offset.
- The user-configured tolerance is a diagnostic threshold, not an acoustic compliance criterion.

## v0.39 — delay advisory
- A geometry-only relative arrival-time estimate is provided from stored loudspeaker coordinates and a manually selected listening point.
- Speed of sound can be adjusted within a guarded range.
- The output is explicitly advisory; it does not account for DSP latency, crossover phase, acoustic centres, reflections or impulse-response verification.
- No DSP control/write operation is implemented.

## v0.40 — field report and Android layout
- JSON survey export includes measured records only and an explicit measurement-integrity declaration.
- Simulated coverage is excluded from the measured report.
- Mobile styles use single-column controls, large touch targets and a compact heatmap grid.

## Non-negotiable integrity rules
- Preserve the existing 3D room planner and all persisted speaker/scene data keys.
- dBFS is never labelled or converted to dB SPL without a verified calibration chain.
- No synthetic measurement values are generated.
- No EQ, gain, mute, delay or routing values are written to a DSP.
- Phone/browser measurements are survey aids, not IEC 61672 or ISO 3382 compliance results.
- Android physical-device validation remains required for microphone routing, storage, performance and long-session stability.

## Validation still required
- Run the focused and full Node test suites and TypeScript/Vite production build.
- Test Android touch interaction and WebGL performance with a large room and speaker inventory.
- Verify coordinates against a measured room plan and test the SPL chain with an acoustic calibrator/reference analyser.
- Confirm the stacked PR sequence is merged in order: v0.35 PR #37, then this v0.36–v0.40 PR.
