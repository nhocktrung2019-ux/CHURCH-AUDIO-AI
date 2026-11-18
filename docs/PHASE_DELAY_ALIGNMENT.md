# Phase & Delay Alignment — v0.32 foundation

## Purpose
Compare simultaneous transfer-phase captures from a reference loudspeaker zone and one or more target zones. The first capture is the reference; each following capture is compared against it.

## Measurement requirements
- Capture all channels simultaneously from one multichannel interface and common hardware clock.
- Use a true electrical output loopback as reference and measurement microphone/input as target; preserve channel mapping.
- Calibrate each input/output channel and characterize round-trip / channel latency before enabling every `DelayEvidence` flag.
- Keep routing, gain, crossover, polarity, microphone position and sample rate fixed during a comparison set.
- Provide phase curves with coherence >= 0.80. At least 12 matched points spanning 500 Hz are required by the underlying delay estimator.
- Phase differences are unwrapped in ascending frequency before weighted linear regression. Estimates outside ±100 ms or with R² < 0.80 are blocked.

## Recommendation sign
The estimated delay is target arrival time minus reference arrival time:
- Positive: target arrives later; recommend adding the absolute difference to the reference zone (the earlier source).
- Negative: target arrives earlier; recommend adding the absolute difference to the target zone.
- This is advisory only. Never apply negative delay or claim that a speaker can be advanced.

## Safety / limitations
- Independent sequential A/B captures are not valid evidence for absolute relative delay.
- A common WebAudio frame clock is not proof of a shared hardware ADC/DAC clock or zero channel skew.
- This module does not write DSP, change polarity, or create crossover settings.
- Confirm recommendations with repeated measurements at multiple listening positions and verify the manufacturer's DSP delay convention before manual entry.
- Phone built-in microphones and uncalibrated audio interfaces are not professional phase references.
