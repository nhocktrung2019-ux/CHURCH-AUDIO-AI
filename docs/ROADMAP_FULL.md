# CHURCH-AUDIO-AI — consolidated six-stage roadmap

| Stage | Scope | Current state | Production gate |
|---|---|---|---|
| 1 | Audio Engine, input/output, USB/OTG, generator | Browser/WebView beta implemented | Android hardware and long-run routing tests |
| 2 | RTA, FFT, RT60, transfer, phase, Leq, calibration | v0.23 adds guided per-input USB loopback capture, exact-route profile storage, repeatability gating and differential Reference/Measurement correction; CI and physical USB routing remain unverified | successful CI, verified channel/output mapping, hardware clock/skew proof, acoustic validation and reference-analyser comparison |
| 3 | Feedback detection, multi-mic, voice assistant | v0.16 beta feedback/multi-mic plus v0.23 local Vietnamese voice-command routing (navigation, measurement start/stop, RTA frequency); hardware and recognition-provider support remain unverified | Multi-device attribution, real-time feedback action verification, Android Web Speech availability/privacy testing and voice UX acceptance |
| 4 | Church 3D, CBT, polar data, coverage | Planning/approximation tools implemented | Surveyed geometry and verified manufacturer polar data |
| 5 | X32/M32, Soundcraft, dbx, CD48 DSP | v0.23 separates seven model/family profiles with documented transport/evidence and manual worksheets; no live control adapter | Exact model/firmware protocol, read-only discovery, safe write/read-back/rollback and physical tests |
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


## v0.22.0-beta.1 implementation status

- Synchronous mode requires two distinct channels from one MediaStream/AudioWorklet frame clock and rejects mono or ScriptProcessor fallback.
- Reference is expected to be an electrical loopback from the selected output to one interface input; Measurement is the microphone on another input.
- H1 magnitude, phase and coherence are computed from simultaneous channels; independent time alignment is not applied.
- Relative delay is estimated with a bounded coarse search plus full-rate refinement.
- Auto EQ is locked for this mode until per-channel ADC/DAC and loopback calibration exist.
- Physical USB routing, ADC/DAC skew, long-duration Android capture and reference-analyser comparison remain unverified acceptance gates.


## v0.23 channel calibration foundation status

- Per-channel loopback calibration can be captured from a selected USB input/output route through AudioWorklet, subject to PCM quality and coherence gates.
- A profile is bound to the selected input device ID, zero-based input channel, output device ID and sample rate; profile data is strictly validated and stored separately for each exact route.
- Saving requires two repeated captures within application-defined magnitude, phase and delay repeatability limits. The limits are regression guardrails, not a certified accuracy specification.
- Synchronous Reference/Measurement H1 can apply a differential correction from the two channel profiles, and only displays the common calibrated frequency band.
- Calibration capture is limited to sample rates no higher than 96 kHz with the current 4096-point FFT so that the accepted band can extend to 50 Hz.
- Browser APIs cannot establish that the selected input and output IDs belong to the same physical USB interface. The operator must verify the line-level loopback wiring and attenuator.
- Auto EQ remains locked in synchronous mode. No Android device, OTG interface, ADC/DAC clock, or reference-analyser test has been verified. GitHub Actions runs observed on this branch failed before runner assignment with zero steps and no APK artifacts.
- Next engineering gate: make GitHub Actions execute tests/build; then exercise USB input/output and per-channel repeatability on Android, compare H1 magnitude/phase/delay with a trusted reference analyser, and only after that consider unlocking dependent features.


## v0.23 local voice command status

- A compact voice-command panel is available from the main workspace.
- Recognized Vietnamese transcript is routed through a deterministic local command parser for workspace navigation, microphone start/stop and RTA frequency selection.
- The parser also supports keyboard text input when the Web Speech Recognition API is unavailable.
- The app does not call an LLM or remote AI service for command interpretation. The underlying browser/WebView Speech Recognition provider may process audio according to its own implementation and policy; the application does not control that service.
- Speech recognition is disabled while the measurement microphone is active to reduce audio-device contention. Text commands remain available.
- This is command control, not conversational AI, DSP control, speech synthesis or a guarantee of offline speech recognition. Those remain separate roadmap items.


See docs/DSP_INTEGRATION_MATRIX.md for the model families, documented transport references and the safety gates required before any direct control adapter is enabled.
