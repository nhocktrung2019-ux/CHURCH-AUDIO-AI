# v0.56–v0.60 — Impulse Response & RT60

## Delivered in this increment

- **v0.56** — typed impulse-response capture contract with PCM, sample rate, input-chain identity, zone, seat and capture timestamp provenance.
- **v0.57** — input validation for sample rate (8–192 kHz), finite normalized PCM, minimum capture length, metadata and clipping.
- **v0.58** — Schroeder backward energy integration with conservative noise-energy subtraction and an exposed decay curve.
- **v0.59** — EDT (0 to −10 dB), T20 (−5 to −25 dB) and T30 (−5 to −35 dB) linear decay fits; RT60 extrapolated from fitted slope.
- **v0.60** — quality gates for noise floor, dynamic range, fit point count and R²; unsupported metrics remain null.

## Measurement rules

- Input is captured linear PCM in normalized full-scale units. The engine does not synthesize an impulse response.
- Output RT metrics are seconds. dBFS is only used for signal/noise diagnostics and is never presented as dB SPL.
- The noise floor can be supplied from an independently measured input-chain noise capture; otherwise a conservative tail estimate is used.
- T20 needs at least 10 dB of margin below its −25 dB fit endpoint; T30 needs the same below −35 dB. EDT is gated against its −10 dB endpoint.
- Clipped, malformed, too-short or invalid-rate captures are blocked. A fit that fails its range or R² gate is omitted, not extrapolated from invented points.
- Results are per capture. No averaging across seats, zones, microphones or sample rates is performed in this increment.
- No automatic DSP writes, EQ changes, gain changes or delay changes.

## Validation

Run `npm test` and `npm run build`. Tests cover a deterministic exponential-decay fixture, clipping, invalid PCM/sample rate, insufficient noise margin and unit/provenance behavior.

## Field acceptance still required

Verify impulse-response acquisition timing, loopback/input latency, microphone calibration, USB audio route changes and noise-floor measurement on the actual Android device and measurement microphone. The deterministic test fixture validates math/guards only; it is not a room measurement and must never be displayed as measured church data.
