# CHURCH AUDIO AI — V0.31–V0.35 stabilization execution

## Baseline verified for this work item

- Base branch: `main`
- Base commit: `c54dce5fa17d628add32cc7efb7c6bf4e3e54612` (2026-11-26)
- Package version: `0.30.0-beta.1`
- README previously reported `0.29.0-beta.1`; this discrepancy is corrected in this branch.
- Current product targets Android through Capacitor and desktop/laptop browsers. A native Windows installer is not yet verified.
- Open device-integration work remains draft: X32 OSC codec foundation (#79), CD48 RS232 command review (#80), and the combined device-specific integration plan (#78).

This tracker records work and acceptance gates. It does not claim physical device validation, production signing, or a Windows installer.

## V0.31 — Repository and release baseline

- [x] Confirm repository access, default branch and base commit.
- [x] Reconcile README beta version with package.json.
- [ ] Run full regression suite on the proposed branch.
- [ ] Run TypeScript/Vite production build.
- [ ] Review all open PRs for stale base branches and CI status.
- [ ] Keep device-integration PRs in Draft until their stated gates pass.

Acceptance: tests and web build pass on the exact merge candidate; documentation matches package metadata.

## V0.32 — Android packaging and device validation

- [ ] Run Capacitor sync and Gradle debug assemble on the exact merge candidate.
- [ ] Confirm APK artifact checksum, package ID, version and build commit.
- [ ] Install on a physical Android phone.
- [ ] Verify microphone permission, input enumeration, USB audio routing where supported, app resume and local persistence.
- [ ] Exercise RTA, spectrogram/waterfall, signal generator, RT60 capture and 3D scene on-device.

Acceptance: artifact is traceable to the tested commit and installs/opens on a real device. Debug APK remains test-only.

## V0.33 — Measurement integrity

- [ ] Verify microphone/input-chain identity and calibration provenance.
- [ ] Verify SPL is withheld when calibration is absent or capture clips.
- [ ] Verify measured, simulated and theoretical values remain separate in reports and 3D overlays.
- [ ] Verify RT decay fit/noise quality gates and transfer-function coherence/repeatability warnings.
- [ ] Verify Auto EQ remains advisory and cut-only; no hardware writes.

Acceptance: invalid or uncalibrated data cannot be presented as calibrated SPL or as a verified hardware correction.

## V0.34 — Equipment catalogue and 3D regression

- [ ] Preserve the existing canonical church 3D scene and saved geometry.
- [ ] Verify speaker specification provenance and unknown-model handling.
- [ ] Verify zone SPL summaries use only compatible calibrated measurement records.
- [ ] Verify delay outputs are labelled advisory until confirmed by synchronous measurements.
- [ ] Verify responsive layout and WebGL behavior on target Android and desktop browsers.

Acceptance: no fabricated manufacturer values, no mutation of saved room geometry, and no mixing of measured/simulated data.

## V0.35 — Integration readiness

- [ ] X32: complete native UDP transport design and tests before claiming a live connection; begin read-only and verify against physical X32 FW 4.15.
- [ ] CD48: keep RS232 command previews non-executing until electrical framing, pacing and response/readback are documented and bench-tested.
- [ ] CD48 Ethernet: do not infer TCP/UDP protocol from RJ45 availability or reuse RS232 strings over Ethernet without vendor evidence.
- [ ] Define Windows packaging target and build/test workflow.
- [ ] Audit Vietnamese/English coverage and voice-assistant scope; README currently states general speech recognition/synthesis are removed.
- [ ] Confirm Android release-signing secrets and continuity before any production release.

Acceptance: each adapter is device-specific, read-only by default, and clearly reports configured/offline/stale/verified states. No DSP writes without explicit confirmation and verified read-back.

## Cross-cutting safety rules

- No guessed SPL calibration, speaker response curves, microphone curves, serial framing or network protocol.
- No automatic DSP writes from Auto EQ, phase, delay or feedback recommendations.
- No claim of IEC 61672 / ISO 3382 compliance from an unverified phone/browser chain.
- No production release claim without signed artifact, install/upgrade test and recorded acceptance.

## Current work in this branch

- Correct the README version label to match package.json.
- Add this execution tracker and link it from README.
- No application runtime code is changed by this documentation-only increment.
