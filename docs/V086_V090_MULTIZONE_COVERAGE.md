# v0.86–v0.90 — Multi-zone SPL coverage and survey report

- v0.86: simultaneous measured dB SPL summaries for all zones.
- v0.87: per-position delta against a selectable reference zone.
- v0.88: coverage percent, common-position count and overlap ratio; repeated captures are duration-weighted energy-averaged before position counting.
- v0.89: spatial review is coordinate-aware at the stored position level but does not interpolate missing cells or infer phase/arrival time.
- v0.90: exportable JSON survey snapshot with evidence class, reference zone and explicit limitations.

Data integrity: only calibrated dB SPL records from one input label and a consistent calibration offset are included. Legacy dBFS is excluded. Missing positions remain missing. No DSP/LAN write is performed. The existing WebGL 3D room and speaker geometry are untouched.
