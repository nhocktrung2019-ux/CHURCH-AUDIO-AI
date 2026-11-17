# CHURCH-AUDIO-AI — consolidated six-stage roadmap

| Stage | Scope | Current state | Production gate |
|---|---|---|---|
| 1 | Audio Engine, input/output, USB/OTG, generator | Browser/WebView beta implemented | Android hardware and long-run routing tests |
| 2 | RTA, FFT, RT60, transfer, phase, Leq, calibration | v0.21 preserves multichannel PCM blocks; current H1 analysis still explicitly downmixes to mono | USB channel mapping, true Reference/Measurement processing, clock proof, per-channel calibration and reference-analyser comparison |
| 3 | Feedback detection, multi-mic, voice assistant | v0.16 beta adds persistence, valid-frame gating and confidence display | Per-device concurrency tests, channel attribution and listening verification |
| 4 | Church 3D, CBT, polar data, coverage | Planning/approximation tools implemented | Surveyed geometry and verified manufacturer polar data |
| 5 | X32/M32, Soundcraft, dbx, CD48 DSP | Manual configuration/export worksheet | Per-model protocol adapter, physical tests, read-back and rollback |
| 6 | Version update, diagnostics, support, signed APK | Support workspace and tag workflow integrated | Permanent signing secrets and signed APK device test |

## v0.20 dual-channel foundation

A pair is eligible for synchronous analysis only when both channels are supplied by the same captured stream and share a sample rate, frame position, frame count and explicitly identified clock domain. Different Bluetooth/USB streams are rejected. A matching label alone is not hardware proof: the integration layer must only declare a shared clock when both channels are read from the same multichannel stream/worklet.

The delay estimator uses broadband correlation, bounds its search range, refines the peak at full sample rate and documents its sign convention. It is not a substitute for acoustic loopback calibration, polarity checks, microphone compensation or physical verification.

## Priority order

1. Preserve measurement validity and avoid false precision.
2. Stabilize Android audio routing on physical hardware.
3. Wire the validated dual-channel primitives into a single USB multichannel capture path.
4. Validate acoustic algorithms against reference instruments.
5. Integrate voice and independent sources without claiming shared-clock synchronization.
6. Expand room and loudspeaker data only from verified sources.
7. Enable DSP control only after exact device adapters pass read/write/rollback tests.
8. Publish stable APKs only with the permanent signing certificate.

Status labels distinguish code availability from hardware verification. Beta code is not production acceptance.


## v0.21 multichannel PCM status

- The microphone request now asks for two channels when the device supports them; mono devices remain supported.
- AudioWorklet transports frame-major interleaved PCM and preserves each channel until the analyzer's explicit mono downmix boundary.
- This does not prove the interface's physical routing or hardware clock synchronization.
- Reference/Measurement channel selection and simultaneous dual-channel H1 analysis remain incomplete.
