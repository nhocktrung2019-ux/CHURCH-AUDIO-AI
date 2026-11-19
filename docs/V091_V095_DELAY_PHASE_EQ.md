# v0.91–v0.95 — Delay, phase and EQ review

- v0.91: geometry-only per-speaker delay estimate at an explicit listener XYZ coordinate. Farthest speaker is the 0 ms reference; speed of sound is validated within 300–360 m/s.
- v0.92: wraps the synchronous phase-slope delay analyzer. Requires simultaneous capture, shared hardware clock, per-channel calibration and characterized latency.
- v0.93: crossover-band phase/polarity review. A near-180-degree result is a verification warning, never an automatic polarity flip.
- v0.94–v0.95: coherent measured-bin, cut-only PEQ review using the existing Auto EQ implementation. No boost; max six filters, max -4 dB per cut.

Safety: all outputs are read-only worksheets. Geometry is not an acoustic measurement; verify with impulse/transfer captures at multiple listening positions. No DSP/LAN writes. Existing 3D scene is not modified.
