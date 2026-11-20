# CHURCH AUDIO AI v1.15 — Release readiness

## Purpose

This stage adds release-quality guardrails without changing acoustic algorithms, measured-point storage, or the 3D room model.

## Included in this stage

- Automated speaker-catalog integrity tests.
- Require HTTPS provenance and a non-empty source note for every published specification.
- Validate finite, positive speaker measurements and bounded coverage angles.
- Keep unverified revisions (Bose 402 V, 802 V, 502 and Column 600/800) selectable as manual/verification-needed entries, without fabricated specification values.
- Record the release gates for Android, Windows, localization and physical audio validation.

## Release status matrix

| Area | Current evidence | Release gate |
|---|---|---|
| Core web app | TypeScript/Vite build in CI | Regression + browser smoke test |
| Android | Capacitor Android debug APK workflow | Reproducible build, device install, mic permission and audio-route test |
| Android production | Debug artifact only | Signing key management, signed release APK/AAB and install/upgrade test |
| Windows | Browser-based web build | Decide desktop packaging target (PWA/browser vs native desktop wrapper), then test audio device permissions and output selection |
| Vietnamese/English | UI currently contains Vietnamese-first strings | Complete translation inventory and language-switch persistence |
| Speaker database | Partial sourced catalogue | Verify exact model revisions and official datasheets |
| Microphone database | Calibration/sensitivity workflows exist | Add only model-specific manufacturer sensitivity/response data with citations |
| DSP/LAN | Address preflight only | Vendor protocol, model/firmware evidence, read-only adapter and physical bench test |
| Acoustic validation | RTA, SPL, RT60 and Auto EQ software paths exist | Calibrated microphone/interface, repeatability, known reference measurements and church-room field test |
| 3D | Existing room planner and measured-point overlay | Verify measured and simulated layers remain visually distinct |

## Safety and measurement claims

- dBFS is not dB SPL; absolute SPL requires a known calibration for the exact microphone/interface/gain chain.
- A/C weighting must be implemented as actual filters before the corresponding label is used for standards-oriented measurements.
- RT60 estimates require valid impulse response, sufficient decay range, noise-floor checks and multi-position assessment.
- A debug APK is not a signed production release.
- A web build that runs in a Windows browser is not the same as a native Windows desktop application.
- A same-subnet check does not establish DSP reachability or protocol compatibility.
- Simulated 3D coverage must never be presented as calibrated measured SPL.

## Acceptance checklist

1. CI regression tests and web build pass on the release candidate commit.
2. Android debug build succeeds and installs on a physical Android device.
3. Production signing and release artifact are configured and verified.
4. Windows delivery target is explicitly selected and tested.
5. VN/EN translation coverage is audited.
6. Speaker and microphone data provenance is reviewed.
7. Microphone calibration and SPL/RT60 repeatability are tested with reference equipment.
8. DSP integration is tested only against a documented exact device/firmware revision.
9. Preserve the existing 3D model, room geometry, zones and measured SPL points through upgrade tests.

Do not mark v1.15 complete until all applicable acceptance checks have evidence.
