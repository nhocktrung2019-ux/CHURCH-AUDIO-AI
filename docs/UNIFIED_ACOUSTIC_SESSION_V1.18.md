# Unified Acoustic Session — v1.18 implementation

## Implemented in this branch

- Persist the latest RT60 band summary under `church-audio-rt60-latest`; only the compact numerical result is persisted, not the raw impulse response.
- Extend Acoustic Intelligence to read the latest RTA, RT60 and Transfer Function records.
- Report five-band RTA summaries, valid octave-band RT60 statistics, transfer coherence coverage and PCM capture quality in one workspace panel.
- Keep the source module status visible so missing measurements are not mistaken for zero values.
- Add integration-level tests for combined report inputs, malformed values and the rule that frequency correction/transfer data do not establish absolute SPL calibration.

## Important session-integrity limitation

The existing modules persist their latest results independently and do not yet share a common immutable session ID, capture timestamp, microphone/input chain fingerprint, room-position ID or calibration-record ID. Therefore this report is a **latest-results overview**, not proof that all charts describe the same acoustic session.

A technician must repeat measurements with unchanged source level, microphone, input gain, position and signal chain before comparing them as a single controlled session. The next engineering step is to introduce a shared measurement-session record and explicit compatibility gate.

## Interpretation and safety

- RTA values remain relative dBFS unless an independently validated SPL calibration record is attached to the exact microphone/input chain.
- A microphone frequency-response correction curve is not absolute sensitivity calibration.
- RT60 is shown only for octave bands whose result and decay-fit quality pass the analyzer gate.
- Transfer coherence is summarized from the saved Transfer Function bins; mono-acoustic mode does not certify absolute phase or speaker-only delay.
- Synchronous dual-channel mode still requires hardware ADC/DAC channel latency and phase calibration.
- The panel does not auto-write EQ or DSP settings and does not make a standards-compliance claim.

## Validation required

- Run `npm test` and `npm run build` on this branch in GitHub Actions.
- Verify localStorage migration and behavior on Android WebView.
- Perform real tests with a calibrated measurement microphone, acoustic calibrator, known reference signal and external USB interface.
- Confirm RT60 repeatability at multiple representative church seating positions.
