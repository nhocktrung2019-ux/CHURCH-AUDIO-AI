# CHURCH-AUDIO-AI — consolidated six-stage roadmap

| Stage | Scope | Current state | Production gate |
|---|---|---|---|
| 1 | Audio Engine, input/output, USB/OTG, generator | Browser/WebView beta implemented | Android hardware and long-run routing tests |
| 2 | RTA, FFT, RT60, transfer, phase, Leq, calibration | v0.17 adds raw PCM capture, capture-quality gates, coherence-gated PEQ and sync-gated phase-slope delay utility | Reference-analyser comparison, AudioWorklet/PCM stability and synchronous dual-channel loopback |
| 3 | Feedback detection, multi-mic, voice assistant | v0.16.0-beta.1 adds per-frame persistence, valid-frame gating and visible confidence | Per-device concurrency tests, channel attribution and listening verification |
| 4 | Church 3D, CBT, polar data, coverage | Planning/approximation tools implemented | Surveyed geometry and verified manufacturer polar data |
| 5 | X32/M32, Soundcraft, dbx, CD48 DSP | Manual configuration/export worksheet | Per-model protocol adapter, physical tests, read-back and rollback |
| 6 | Version update, diagnostics, support, signed APK | Support workspace and tag workflow integrated | Permanent signing secrets and signed APK device test |

## Priority order

1. Preserve measurement validity and avoid false precision.
2. Stabilize Android audio routing on physical hardware.
3. Validate acoustic algorithms against reference instruments.
4. Integrate voice and independent input sources without claiming shared-clock synchronization.
5. Expand room and loudspeaker data only from verified sources.
6. Enable DSP control only after an exact device adapter passes read/write/rollback tests.
7. Publish stable APKs only with the permanent signing certificate.

Status labels intentionally distinguish code availability from hardware verification. A feature can be present in the beta and still be unsuitable for an acceptance measurement or production control task.
