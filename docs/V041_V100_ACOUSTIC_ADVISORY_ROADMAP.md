# CHURCH AUDIO AI — v0.41 to v0.100 engineering plan

## Increment status

This branch adds the read-only acoustic advisory engine for the v0.41–v0.47 foundation. It is intentionally a domain-engine increment: no changes are made to the existing 3D room planner, saved speaker/zone records, measurement storage schema, DSP connection layer, or Android packaging. The existing v0.35–v0.40 work remains in the parent branch and must be merged in stack order.

### Delivered in this increment

| Version | Scope | Status in this branch |
|---|---|---|
| v0.41 | Survey integrity gate: unit, input identity, labels, numeric values, coordinates and calibration consistency | Implemented in \`assessSurveyQuality\` |
| v0.42 | Repeat-capture anomaly flagging using median/MAD | Implemented in \`detectSurveyOutliers\`; flags only, no deletion |
| v0.43 | Zone-balance technician advisory | Implemented in \`buildZoneAdvisoryPlan\`; reuses existing zone comparison rules |
| v0.44 | Before/after comparison at matched positions and matching input/unit/calibration | Implemented in \`compareSurveySessions\` |
| v0.45 | Ideal rectangular-room axial mode estimates | Implemented in \`estimateAxialRoomModes\`; explicitly theoretical |
| v0.46 | Auditable DSP change proposal envelope | Implemented in \`createDspAdvisoryProposal\`; \`writeEnabled: false\` is a literal type and runtime value |
| v0.47 | Focused regression coverage | Added \`tests/acousticAdvisoryEngine.test.mjs\` |
| v0.48 | Android advisory panel, review queue and technician acknowledgement | Planned; engine is not yet wired into the UI |
| v0.49 | Survey-quality and outlier annotations in JSON/CSV report | Planned; existing report format is not silently changed |
| v0.50 | Field validation, calibration traceability and UX acceptance | Pending CI and physical-device validation |

## Scope for v0.51–v0.100

The later versions are a staged engineering roadmap, not a claim that all of these capabilities are already implemented.

| Version range | Engineering scope | Acceptance requirement |
|---|---|---|
| v0.51–v0.55 | Frequency-response measurement sessions, repeat alignment, coherence/quality gating, per-zone response comparison | Same sample rate, known input-chain identity, minimum repeat count and explicit rejection of low-coherence data |
| v0.56–v0.60 | Impulse-response workflow, RT60/EDT/T20/T30 eligibility checks, noise-floor and decay-line diagnostics | Correct time window and decay range; no RT60 result when noise floor or decay range is inadequate |
| v0.61–v0.65 | Feedback-risk assistance, narrowband tone watch, operator alert history and false-alarm controls | Alert-only initially; no automatic notch filter or mute |
| v0.66–v0.70 | Speaker and microphone profile provenance, manufacturer-response data, polar coverage and overlap analysis | Curves must come from verified datasheets or measurements; unknown curves remain unknown |
| v0.71–v0.75 | Multi-zone optimization, spatial listening-point weighting, 3D placement review and measured-vs-simulated separation | Existing 3D room scene and saved speaker positions must remain backward compatible |
| v0.76–v0.80 | Mixer/DSP profile registry, model/firmware capability matrix, LAN discovery design and read-only adapter prototypes | Explicit protocol and device identity; read-back verification; no guessed register maps |
| v0.81–v0.85 | Controlled DSP workflow design, change previews, snapshots, rollback and operator approvals | Separate feature gate, model-specific tests and explicit human confirmation; default remains read-only |
| v0.86–v0.90 | Android field workflow, offline-first session handling, external USB audio compatibility and performance improvements | Physical-device tests for permissions, input routing, lifecycle, storage, touch targets and WebGL |
| v0.91–v0.95 | Vietnamese/English completeness, project templates, audit trails, export/import validation and documentation | Stable schema migrations, round-trip tests and no silent loss of project data |
| v0.96–v0.100 | Full integration, regression hardening, signed Android release, Windows packaging and deployment guides | Reproducible CI artifacts, signing configuration, clean install/upgrade tests and physical acceptance |

## Measurement integrity contract

- dBFS is relative digital level. It is never converted to dB SPL without a verified calibration offset for the matching microphone and input chain.
- dB SPL records must carry a consistent calibration offset; this software check cannot independently prove calibrator accuracy.
- No test, demo, simulation or theoretical mode estimate is inserted into the measured record log.
- Theoretical axial modes are labelled \`theoretical-estimate\` and must not be presented as a measured room response or as a substitute for impulse-response/RT60 measurements.
- Outlier detection marks data for operator review. It never deletes, rewrites or silently excludes original measurements.
- Before/after comparisons require matched positions and the same unit and input identity. A comparison does not establish that an intervention caused the result.
- Zone balance, frequency-response evidence and geometry-only delay are separate evidence types; one is not a substitute for another.

## DSP safety contract

This increment does not connect to or write to a DSP. The proposal envelope is documentation for a technician's review, not an executable command. It keeps \`writeEnabled: false\` and requires model/firmware identification, official protocol evidence, read-back, configuration backup, rollback planning and human application. A later write-capable implementation would require a distinct, model-specific reviewed change and explicit approval; it must not be enabled by this branch.

## Backward-compatibility contract

- Keep the Three.js/WebGL 3D room planner and its existing scene objects.
- Keep saved room dimensions, speaker coordinates, names and zone assignments.
- Keep the existing measurement key and support legacy captures with no X/Y coordinates.
- Do not migrate or overwrite speaker databases as part of the advisory-engine work.
- New metadata should be additive and use explicit versioned schema migrations when UI persistence is introduced.

## Validation still required

This branch has not yet been run through the repository's complete test command, TypeScript/Vite build, GitHub Actions, Android physical-device tests or acoustic reference measurements. The new test file covers the isolated pure-function contracts only. Before treating any release as field-ready, run:

1. \`npm test\`
2. \`npm run build\`
3. CI on the complete stacked PR chain
4. Android microphone routing, app background/foreground, storage, touch and 3D/WebGL checks on actual supported phones
5. Calibration checks using an appropriate acoustic calibrator and reference analyser
6. DSP read-only verification against the exact named hardware model and firmware

No APK or Windows installer is produced by this branch.
