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


## Increment 2 — independent multi-source input evidence

- Multi-source monitoring now checks the actual `MediaStreamTrack` returned for each selected input.
- When the browser exposes both requested and actual device IDs, a mismatch rejects that source rather than silently labelling the wrong microphone as selected.
- Each source reports track state, actual sample rate/channel count/latency when exposed, and echo cancellation / noise suppression / AGC flags.
- Missing device identity or track metadata is labelled unconfirmed rather than treated as a successful hardware validation.
- Separate `getUserMedia` streams remain independent capture paths. A shared AudioContext does not prove the ADCs share a physical clock or have sample-aligned start times.
- The cross-source composite is explicitly a relative trend view. It must not be used for phase, transfer function, absolute delay, calibrated SPL or phase-coherent feedback cancellation.
- Voice recognition is stopped before measurement capture and blocked while multi-source measurement is active to reduce microphone contention.
- Regression tests cover route mismatch, missing metadata, muted/ended tracks, audio-processing flags and the non-synchronous source gate.

### Remaining acceptance gates

- Run all tests and the TypeScript/Vite build in a functioning CI runner.
- Verify concurrent input support and per-device routing on specific Android/WebView + USB interface combinations.
- Characterize gain, latency and drift per microphone; calibrate each input independently.
- For phase/transfer/delay, use a single multichannel hardware interface with verified common clock and preserved PCM channels. Independent Bluetooth/USB capture streams are not accepted as synchronous.


## Increment 3 — verified multichannel capture foundation (next)

### Scope
- Add a hardware capability profile for one USB-OTG multichannel interface at a time.
- Preserve channel-to-input mapping from the device's PCM stream; do not reopen each channel as a separate browser microphone.
- Capture actual PCM sample rate, channel count, bit depth/format, frame counters and overrun/underrun counters when the native capture layer exposes them.
- Add per-channel gain, polarity, sensitivity and acoustic calibrator metadata with explicit calibrated / uncalibrated status.
- Add a shared-clock evidence gate. Phase, transfer function and inter-channel delay tools remain disabled until the same hardware stream and channel frame alignment are verified.
- Record start/stop timestamps, dropped-frame count and drift diagnostics. Do not infer common clock from equal nominal sample-rate labels.
- Add a repeatable acceptance procedure using electrical loopback first, then acoustic impulse/known-distance tests.
- Keep independent Bluetooth microphones available for non-coherent monitoring only; never combine them for phase-coherent measurements.

### Acceptance criteria
1. One multichannel USB interface is enumerated and selected as one capture device.
2. All requested channels arrive in one PCM frame stream with stable channel mapping.
3. No unreported frame drops during a 10-minute capture soak test.
4. Measured sample rate and clock drift are reported from captured frames, not nominal labels alone.
5. Electrical loopback verifies inter-channel alignment and polarity.
6. Acoustic delay validation is compared with a known-distance reference and documented uncertainty.
7. Android devices / WebView versions and USB interfaces tested are listed explicitly.
8. Full unit tests, Vite build, Android Gradle build and APK artifact are green before the feature is enabled by default.

### Out of scope until protocol evidence exists
- Claiming sample-accurate sync for independent Bluetooth and USB streams.
- Enabling phase/transfer/absolute delay across unverified devices.
- Sending writes to DSP hardware without model/firmware-specific protocol verification, read-back and rollback.
