# v1.10 — SPL capture integrity

## Scope

This increment adds a deterministic analysis layer for an already captured mono,
normalized PCM buffer. It does not request microphone permission, select an input
device, or capture audio itself.

## Measurement rules

- PCM must be finite, normalized to the range -1..1, and contain at least 128 samples.
- Accepted sample rates are 8 kHz through 384 kHz.
- DC offset is removed before RMS is calculated.
- A/C-weighted captures must declare that the matching weighting filter was
  already applied upstream. This module does not implement those filters.
- Z weighting can analyze the unweighted PCM stream; the result carries a warning
  so the operator can verify the input chain.
- A calibration offset is specific to the microphone, interface, gain setting and
  measurement chain. Without it, the result remains dBFS and SPL is null.
- If more than 0.1% of samples reach the clipping threshold, the SPL result is
  withheld.
- This module never infers calibration from a device name and never converts
  dBFS to dB SPL without an explicit offset.

## Next integration step

Connect the Web Audio capture pipeline to this pure analysis function, then add
a calibration workflow using a traceable acoustic calibrator (commonly 94 dB SPL
at 1 kHz). Persist the calibration record with microphone/interface identity,
gain, date, reference level and operator. Validate with a calibrated meter before
using readings for room tuning.

## Not yet claimed

This increment is not a complete live SPL meter. It does not implement IEC
frequency/time weighting, Leq/Lmax time histories, microphone correction curves,
or hardware validation. Those must be implemented and verified before claiming
standards-compliant sound-level measurements.
