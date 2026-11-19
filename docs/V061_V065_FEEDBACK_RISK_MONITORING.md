# v0.61–v0.65 — Feedback risk monitoring

## Scope
- v0.61: validated time-series spectral frames with consistent frequency grid, zone, seat and timestamp provenance.
- v0.62: narrowband peak prominence against neighboring bins and measured noise-floor margin.
- v0.63: frequency stability and persistence across consecutive frames; transient peaks are rejected.
- v0.64: per-zone/per-seat risk classification (watch/alert) and a bounded advisory score.
- v0.65: auditable raised/sustained/cleared event history with configurable clear-window hysteresis.

## Safety and interpretation
- Analyzer input and level diagnostics are dBFS, never dB SPL.
- A persistent narrow tone is only a **possible feedback risk**. Sustained musical notes, test tones and other tonal sources can resemble feedback; a human operator must verify.
- Frames from different zones or listening positions cannot be mixed in one analysis.
- Frequency grids and timestamps must be consistent. Invalid or incomplete input is blocked.
- No automatic notch filter, mute, gain, EQ, delay or DSP/LAN write is performed.
- No simulated spectrum is emitted by the runtime engine. Test fixtures are deterministic software fixtures, not room measurements.

## Validation
Run `npm test` and `npm run build`. Tests cover persistent and transient peaks, mixed-zone rejection, grid mismatch, clear spectra and alert-history hysteresis.

## Field validation still required
Confirm FFT size/window/overlap, analyzer update rate, microphone/input calibration, acoustic coupling and false-positive rates with real church audio on the target Android device. Tune thresholds only from documented field captures.
