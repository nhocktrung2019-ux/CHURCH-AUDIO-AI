# Zone Frequency Response Analyzer — v0.31 foundation

This module compares transfer-function curves across labelled loudspeaker zones.

## Measurement protocol
- Measure at least three repeats per zone, with the microphone fixed at the same listening point for each repeat.
- Keep the microphone, preamp gain, DSP routing, speaker feed, reference signal and sample rate unchanged across zones. The caller must supply a stable `inputChainId` describing this chain.
- Use transfer curves with coherence >= 0.80. Repeat bins with more than 3 dB spread are excluded.
- Interpolation is limited to gaps no wider than 0.25 octave. The module does not extrapolate beyond measured data.
- Spatial spread above 8 dB is surfaced as a warning status; it is not hidden or automatically corrected.

## Output
Per frequency bin: coverage, per-zone median magnitude, repeat spread, coherence, spatial spread and a status. Summary values include median and maximum spatial spread plus excluded-bin counts.

## Safety and limitations
- This is an analysis primitive, not a calibrated sound-level measurement.
- Curves are only comparable when the input-chain identity and sample rate match. A matching string is operator-supplied metadata, not hardware verification.
- It does not generate or write EQ, gain, delay or DSP parameters.
- A future UI should link these results to saved SPL zone records and room-map positions, and should show missing coverage and repeatability failures explicitly.
