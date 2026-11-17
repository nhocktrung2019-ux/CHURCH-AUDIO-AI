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
- [x] Android native X32/M32 OSC UDP read-only bridge (private LAN IPv4, UDP 10023).
- [x] Read-only batch monitor for input channels, buses, main, matrices, aux, FX returns and DCA.
- [x] Two-second selected-strip monitor and local/exportable read-only snapshots.
- [ ] Hardware validation against real X32 and M32 consoles/firmware.
- [x] Implemented guarded X32 input-channel writes: read-before-write conflict check, constrained fader/preamp/EQ/delay controls, explicit confirmation, post-write readback and one-parameter restore. Software milestone only; hardware acceptance remains pending.
- [ ] Scene/snapshot restore only after guarded write controls are validated.
- [ ] Separate model-specific driver research and validation for dbx DriveRack/ZonePRO and dBacoustics CD48/CD48 Premium.
- [ ] Soundcraft Ui browser workflow; HiQnet/ViSi Remote models only after protocol/SDK validation.

## Safety and accuracy
- Browser dBFS is digital level, not calibrated SPL.
- SPL requires microphone sensitivity calibration and a known acoustic reference.
- Phone microphones, Bluetooth paths, AGC, echo cancellation, OS resampling and unknown latency can invalidate precision measurements.
- Do not fabricate manufacturer response curves or presets.
- Test tones can be hazardous downstream of powerful amplifiers; start low and follow venue safety procedures.
