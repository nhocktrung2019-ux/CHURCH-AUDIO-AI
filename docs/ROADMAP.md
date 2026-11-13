# Roadmap and measurement integrity

## Phase 1 — Measurement MVP
- [x] Browser microphone capture (Web Audio API)
- [x] FFT live spectrum and peak digital level
- [x] Device enumeration
- [x] Sine test signal with software attenuation
- [ ] Calibrated log-frequency RTA, averaging and weighting
- [ ] Scrolling spectrogram with calibrated axes
- [ ] Android and desktop browser hardware tests

## Phase 2 — Acoustic measurements
- Impulse response with known test signal and synchronized reference.
- RT60/T20/T30 only when signal-to-noise ratio and decay range meet validity checks.
- Multi-position records with microphone coordinates.
- Delay via cross-correlation; phase requires coherent reference and known latency.

## Phase 3 — System tuning
- Parametric EQ suggestions from verified measurements, with manual review and undo.
- Feedback risk detection from narrow persistent peaks; never automatically boost gain.
- Crossover, polarity, gain structure, limiter and compressor guidance.
- Equipment presets only from manufacturer documents or measured data.

## Phase 4 — Spatial design and control
- Room geometry and multi-zone speaker layout.
- 3D direct-field coverage estimates with explicit assumptions.
- LAN/Wi-Fi DSP control after protocol and model validation.

## Safety and accuracy
- Browser dBFS is digital level, not calibrated SPL.
- SPL requires microphone sensitivity calibration and a known acoustic reference.
- Phone microphones, Bluetooth paths, AGC, echo cancellation, OS resampling and unknown latency can invalidate precision measurements.
- Do not fabricate manufacturer response curves or presets.
- Test tones can be hazardous downstream of powerful amplifiers; start low and follow venue safety procedures.
