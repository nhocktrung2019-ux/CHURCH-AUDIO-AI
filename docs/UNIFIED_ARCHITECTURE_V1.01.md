# CHURCH AUDIO AI — Unified Architecture & Integration Plan

**Milestone:** v1.01 architecture baseline  
**Application package version:** 0.30.0-beta.1 (kept separate from the v1.01 roadmap milestone)  
**Status:** architecture baseline and integration branch; implementation remains incremental and evidence-gated.

## 1. Product direction

CHURCH AUDIO AI is one bilingual (Vietnamese/English) acoustic measurement, system-design and tuning workspace for church sound systems. Android and Windows are delivery targets. The existing Three.js room planner is the canonical 3D foundation and must be preserved; new capabilities extend it through adapters and overlays rather than replacing its scene or importing unrelated legacy-file features.

## 2. Unified module map

| Domain | Responsibility | Shared inputs / outputs |
|---|---|---|
| 3D Acoustic Engine | Room geometry, listener/measurement positions, loudspeaker placement, zone identity and 3D overlays | Room/zone/speaker IDs and normalized coordinates |
| SPL Intelligence | Calibrated SPL captures, per-zone summaries, coverage/uniformity and heatmap layers | Measurement records with calibration and provenance |
| Room Analyzer | RTA, spectrogram, waterfall, RT60/EDT and room-response diagnostics | Raw capture metadata, frequency/time series |
| Speaker Alignment | Transfer function, delay, polarity/phase and multi-zone alignment worksheets | Synchronous capture pairs and per-channel calibration |
| Auto EQ & Feedback | Target-aware, multi-position advisory PEQ and persistent feedback candidates | Quality-gated response data; advisory output only |
| Equipment Library | Speaker/microphone model profiles, sensitivity, response and processing starting points | Versioned model profiles with source/verification status |
| DSP & Mixer Network | Import/export configuration and later LAN/Wi-Fi device adapters | Explicit device profiles, protocol capability and operator approval |
| AI Assistant | Bilingual workflow guidance and explanation of measured results | Read-only access to validated project summaries |
| Reports & Delivery | Project backup, measurement reports, diagnostics and Android/Windows packaging | Versioned project schema and build metadata |

## 3. Architectural boundaries

- **Application shell:** navigation, language selection, project lifecycle and permissions.
- **Domain core:** typed project, room, zone, speaker, microphone, measurement and calibration records. Domain calculations must not depend on React components.
- **Measurement adapters:** browser/WebAudio/AudioWorklet capture today; platform-native adapters may be introduced only behind the same contract.
- **Analysis services:** pure, testable DSP calculations with explicit units, sample rates, channel maps and quality gates.
- **3D presentation:** existing Three.js scene remains authoritative for geometry and object placement. Domain overlays consume stable IDs and coordinates; they must not duplicate room geometry.
- **Persistence and migration:** versioned project schema, safe migration, validation and export/import. Existing local-storage state must remain readable during migration.
- **Hardware adapters:** DSP/mixer protocols are isolated by manufacturer/model; no guessed protocol, network scan, or write operation.
- **Presentation:** Vietnamese/English labels are separate from domain values and persisted data.

## 4. Canonical data contracts

All new modules should converge on these logical records (TypeScript types should be introduced in the domain layer before feature-specific UI):

- `Project`: id, schemaVersion, name, locale, createdAt, updatedAt.
- `RoomModel`: id, dimensions/geometry, coordinateUnit, sceneVersion.
- `Zone`: id, name, position/region, targetSplDb, linkedSpeakerIds.
- `Speaker`: id, modelProfileId, zoneId, position, orientation, processingProfileId.
- `MeasurementSession`: id, startedAt, captureSource, sampleRateHz, channelCount, inputLabel, gain/routing notes, calibration references, operator and environment notes.
- `MeasurementPoint`: id, sessionId, zoneId, position, metric, value, unit, weighting, timeWindow, qualityStatus.
- `CalibrationProfile`: id, device/microphone identity, calibration type, date, reference level/file and validity notes.
- `AnalysisResult`: id, algorithm/version, source measurement IDs, result units, confidence/coverage and limitations.
- `ProcessingRecommendation`: id, target device/profile, parameters, rationale, safety limits and status (advisory/approved/applied).

Every physical SPL value must declare its calibration basis, weighting and measurement window. dBFS, calibrated dB SPL, simulated values and interpolated estimates are different data classes and must never be silently mixed.

## 5. SPL-to-3D integration rules

1. Preserve the current `RoomPlanner3D` geometry and interaction model.
2. Give each zone and measurement point a stable ID; never rely on array position as identity.
3. Render measured points distinctly from interpolated or simulated coverage.
4. Do not render a continuous heatmap until there are sufficient spatial samples and a declared interpolation method.
5. Display sample count, coverage, calibration status, target, min/max and energy-averaged SPL with the selected region.
6. Keep the manual SPL worksheet as a valid data-entry path; it is not represented as automatic microphone positioning or automatic zone measurement.
7. Record microphone position, height, orientation, weighting, integration time, source/zone and signal-chain notes for repeatable comparisons.

## 6. Measurement integrity and safety gates

- Keep raw PCM metadata and capture provenance attached to every analysis.
- Reject discontinuous, clipped, invalid or inconsistent capture sessions before phase, delay or Auto EQ analysis.
- Phase/delay claims require simultaneous channels on a verified shared clock and per-channel latency/response calibration. Otherwise show an unavailable/estimated state, not a fabricated alignment.
- Auto EQ remains a cut-only advisory workflow with quality/coverage gates; no automatic DSP writes.
- Feedback detection is advisory. No automatic mute, gain increase or aggressive EQ.
- Signal generation starts at a conservative level with clear operator warnings.
- SPL reports distinguish calibrated measurement from relative dBFS and model-based simulation.

## 7. Integration sequence

### Track A — Architecture and data foundation
- A1: publish this unified architecture and module boundaries.
- A2: define shared domain types, units, IDs and project schema version.
- A3: add persistence migration and validation tests.
- A4: add bilingual labels and capability/status vocabulary.

### Track B — Feature implementation
- B1: connect SPL zones and measurement points to stable 3D room IDs.
- B2: add honest 3D measured-point visualization; introduce interpolation only with explicit coverage rules.
- B3: implement calibrated per-zone SPL capture workflow and repeatability checks.
- B4: add uniformity analysis and before/after comparisons.
- B5: integrate room analysis, alignment, Auto EQ and feedback through shared measurement records.
- B6: add verified equipment profiles and source metadata.
- B7: add device-specific LAN/DSP adapters after protocol and hardware validation.
- B8: add bilingual assistant and report generation.

### Track C — Delivery and verification
- C1: automated unit/regression tests and TypeScript/Vite build.
- C2: Android Capacitor sync and debug APK CI artifact.
- C3: physical Android and calibrated microphone acceptance tests.
- C4: Windows packaging and device compatibility.
- C5: release checklist, migration/backup verification and user documentation.

## 8. Current known baseline

- Existing app is a React + TypeScript + Vite workspace with Three.js and Capacitor Android dependencies.
- Existing room planner: `src/audio/RoomPlanner3D.tsx`.
- Existing manual zone worksheet: `src/audio/SPLZoneMapPanel.tsx`.
- Existing app version constant: `src/appVersion.ts` = 0.30.0-beta.1.
- At this baseline, the SPL zone worksheet accepts operator-entered readings. A live calibrated per-zone SPL capture workflow and a true measured 3D heatmap are not claimed complete.
- This architecture document does not claim that a build, test suite, APK, Windows package or physical hardware test has run.

## 9. Definition of done for the v1.01 foundation

- Shared contracts and unit conventions are documented and implemented in typed code.
- 3D room geometry remains intact.
- Measured, simulated and interpolated values are visually and structurally distinct.
- Existing saved projects remain readable or have tested migrations.
- Invalid or uncalibrated SPL data cannot be presented as calibrated physical SPL.
- Tests cover schema validation, measurement provenance and zone-to-3D identity.
- Build and platform packaging status is reported from actual CI/tool results only.
