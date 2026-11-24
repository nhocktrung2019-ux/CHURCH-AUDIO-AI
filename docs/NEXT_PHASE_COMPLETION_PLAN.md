# CHURCH AUDIO AI — Next Phase Completion Plan

This plan prioritizes a testable, safe product over adding disconnected features. It does not claim that any pending feature is implemented.

## Release gates

A feature is complete only when its code, automated tests, platform build, and documented device validation are all recorded. Simulated/modelled values must remain visibly separate from measured values. No DSP write path is enabled until the exact device protocol, authentication, parameter ranges, read-back, timeout, and rollback behavior are verified.

## Work order

### P0 — Stabilize the existing measurement foundation
- Rebase and validate stacked measurement PRs in dependency order; do not merge a child before its base.
- Run the full Node test suite and TypeScript/Vite production build on the final candidate commit.
- Verify microphone permission, input selection, capture continuity, app background/foreground behavior, local persistence, and WebGL/touch performance on a physical Android device.
- Keep uncalibrated readings in dBFS; only label dB SPL when the selected input chain has an explicit calibration record.
- Validate RT60 repeatability with a known interface/microphone chain and retain fit/noise-quality indicators.

Acceptance: clean CI on the candidate commit, repeatable test record, and no regression in the retained 3D room planner.

### P1 — Complete measured SPL zones and delay advisory
- Integrate the calibrated SPL analysis and live point-capture work only after their prerequisites are merged.
- Require explicit X/Y/Z survey coordinates, microphone identity, weighting, calibration offset, timestamp, and operator notes.
- Show measured points, interpolated cells, modelled coverage, insufficient coverage, and out-of-range cells as distinct states.
- Calculate geometric arrival-time/delay recommendations per speaker and listening reference; disclose that room reflections, DSP latency, crossover phase, and group delay are not measured by geometry alone.
- Do not write delay values to hardware.

Acceptance: tests for mixed calibration/input rejection, invalid coordinates, clipping, insufficient spatial coverage, and repeat captures; on-site verification with a reference analyser.

### P2 — Equipment database and tuning reports
- Keep manufacturer source, exact model/revision, units, test standard, and unknown fields with every loudspeaker specification.
- Add microphone records only from exact manufacturer documentation; distinguish sensitivity, frequency response, polar pattern, connector, and phantom-power requirements.
- Treat Gate/Expander, Compressor, Limiter, and PEQ as advisory starting points with headroom and safety notes.
- Keep Auto EQ cut-only and operator-approved; export a versioned report with source measurements and confidence/coherence.

Acceptance: source-provenance tests, range/unit validation, unknown-model tests, and human review before any setting is applied.

### P3 — LAN/DSP integration (read-only first)
- Implement one adapter per exact DSP/mixer model; do not use a generic protocol assumption.
- First support explicit endpoint configuration, connection timeout, authentication, read-only device identity/status, and structured diagnostics.
- Add parameter read-back and simulator/mock tests before any write operation.
- Only later consider writes for explicitly supported parameters with bounds, confirmation, audit log, and rollback/fail-safe behavior.

Acceptance: protocol document and hardware-in-the-loop test for each supported model. A same-subnet check alone is not a connected-device test.

### P4 — Platform and language completion
- Complete Vietnamese/English string coverage and verify language switching without losing project state.
- Validate Android APK installation, permissions, audio routing, update/signing continuity, and offline behavior.
- Decide and implement a native Windows packaging route; browser support alone is not a Windows installer.
- Keep voice guidance as a separate opt-in milestone: accessibility narration/help prompts first, then command recognition only after confirmation UX and offline/network/privacy behavior are defined.

Acceptance: Android device matrix, Windows installer smoke test, VN/EN string audit, and release-signing checklist.

## Immediate next actions
1. Review and merge the existing stacked PRs in dependency order, beginning with the verified speaker-data foundation where its base is current.
2. Run CI on the exact head SHA after each merge; never carry forward a previous run's success to a new commit.
3. Produce one Android debug artifact from the integrated candidate and run the physical-device checklist.
4. Keep production release blocked until signing, hardware validation, DSP protocol evidence, and Windows packaging are complete.

## Current known constraints
- Browser/phone microphone readings are not certified sound-level measurements by default.
- Separate audio input streams may not share a hardware sample clock.
- The 3D coverage and geometry-based delay model are planning aids, not a substitute for measured room response.
- DSP catalogue worksheets are not live control.
- Voice recognition/synthesis is not currently part of the integrated README scope.
