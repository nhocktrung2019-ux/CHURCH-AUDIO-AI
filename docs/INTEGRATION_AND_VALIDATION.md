# Integration and validation

### v0.22.0-beta.1 — synchronous two-channel Transfer Function

- Added a dedicated mode with Reference and Measurement channel selectors.
- Synchronous mode requires two distinct channels from the same MediaStream and AudioWorklet frame clock; ScriptProcessor fallback is rejected.
- The test signal is routed to the selected AudioContext output using `AudioContext.setSinkId` when supported. The selected output must be the same USB interface used for capture.
- The operator must physically loop the interface output to the Reference line input and connect the measurement microphone to a separate input channel. Use a line-level pad/attenuator where needed; never connect a power-amplifier output directly to the interface input.
- Welch H1 magnitude, phase and coherence are calculated on the simultaneous channel pair without independent phase time-alignment.
- Relative delay uses a reduced-rate coarse search followed by full-rate refinement.
- Synchronous Auto EQ is intentionally locked until separate channel/input-output calibration is implemented.
- This release does not establish ADC/DAC channel skew, absolute system latency or calibration accuracy from metadata alone.

### Required release acceptance

- Run all repository tests, TypeScript/Vite build and Android APK packaging in GitHub Actions.
- Test at least one two-input USB audio interface on physical Android hardware and verify the actual channel mapping with a loopback signal.
- Verify stable frame continuity during sustained capture, reconnects and device sample-rate changes.
- Compare magnitude, phase, coherence and delay against a calibrated reference analyser.
- Keep the PR Draft and do not publish a stable APK until all gates pass.
