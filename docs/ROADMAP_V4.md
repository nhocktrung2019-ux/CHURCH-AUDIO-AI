# V4 development track — system health and measurement integrity

## Purpose

V4 is a staged engineering track built on the v0.23 calibration, voice-command and DSP-reference foundation. The first increment adds a non-invasive system preflight so a technician can identify Android/WebView capability and routing limitations before starting a measurement.

## Increment delivered in this branch

- Add an Audio System Preflight panel to Technical Support.
- Inspect secure-context, MediaDevices/getUserMedia, Web Audio, AudioWorklet, output selection, Speech Recognition and browser-reported microphone permission.
- Enumerate audio input/output counts without requesting microphone access or starting playback.
- Distinguish API availability from measurement readiness and from synchronized multi-channel hardware validation.
- Add pure regression tests for ready, permission-required, blocked and limited environments.

## V4 priorities

1. **Stability and evidence:** make CI execute test/build steps reliably; record Android model, OS, WebView, USB interface, selected routes and test outcomes without collecting audio or private device identifiers.
2. **Measurement integrity:** validate the real USB interface channel map, common hardware clock, ADC/DAC skew, calibration repeatability and reference-analyser agreement before enabling production transfer/phase/Auto EQ claims.
3. **DSP integration:** maintain model-specific profiles. Implement a transport only from verified vendor documentation or a vendor-supported interface. For CD48 USB, the public INTEK guide documents a Windows COM-port/login workflow but does not publish the serial framing or parameter protocol; do not guess baud, packet bytes or login payload.
4. **Church simulation:** improve editable room geometry, speaker placement, verified polar/coverage inputs and zone-based delay calculations. Clearly mark modeled vs measured values.
5. **Release quality:** run the full test suite, web build and Android debug build; verify APK artifact and test on physical Android devices before declaring a beta usable.

## Safety and interpretation rules

- The preflight panel does not request microphone permission, record audio, play a test signal or transmit DSP commands.
- An available AudioWorklet API does not prove that two channels share a physical clock.
- Enumerated device counts do not prove which physical connector is active or whether Android routes the requested device.
- Browser-reported permission does not prove acoustic microphone calibration.
- DSP profiles remain manual-only until exact model, firmware, protocol, read-back, safe-write and rollback behavior are validated.
- A debug APK is a test artifact, not a signed production release.

## Validation status

The regression tests in this branch are authored but still require a successful CI run. The latest inspected v0.23 Actions run failed before any job steps were created and exposed no downloadable job log; this does not establish a source-code test failure or a passing build. No physical Android or DSP hardware test is claimed.
