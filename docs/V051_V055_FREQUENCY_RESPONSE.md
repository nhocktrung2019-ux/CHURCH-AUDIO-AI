# v0.51–v0.55 — Frequency-response analysis

- **v0.51:** integrity checks for measured frequency bins, sample-rate and input-chain identity, monotonic frequency axis, coherence and matching frequency grids.
- **v0.52:** repeatability gate; three sweeps per listening position by default. Low coherence or incomplete repeats require review.
- **v0.53:** spatial zone curves; amplitude-average repeated sweeps at each seat, then weight each seat equally. Retain source sweep IDs.
- **v0.54:** optional fractional-octave smoothing in linear-amplitude space; source data is not mutated.
- **v0.55:** compare zone curves only on matching frequency grids and expose per-bin repeatability spread.

## Measurement contract
- Output is **relative-response dB**, not absolute dB SPL.
- Only measured sweep input is accepted. No synthetic sweep, fabricated bins, missing-value interpolation or invented speaker data.
- Coherence below threshold is excluded from aggregation but remains visible in quality warnings.
- Three repeats are an application workflow default, not a standards certification.
- Equal spatial weighting prevents positions with more repeats dominating the zone response.
- Keep raw/unsmoothed sweeps for diagnosis; smoothing is a display aid.
- No Auto EQ or DSP writes are introduced.
- Existing 3D scene, saved speaker positions, zones, SPL records and calibration are untouched.

## Validation
Seven focused Node tests added. Full npm test, npm run build, CI and physical audio-interface/reference measurements remain required. No APK is produced by this increment.
