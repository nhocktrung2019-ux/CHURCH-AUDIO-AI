# Integration and validation

### v0.20.0-beta.1 — synchronous dual-channel foundation

- Adds a pure validator for two distinct channels sharing one capture session, source stream, sample rate, frame start/count and declared clock domain.
- Adds strict planar-channel extraction and a bounded broadband relative-delay estimator with a tested sign convention.
- Regression tests cover independent stream/clock rejection, frame/sample-rate mismatch, incomplete channel data and a known synthetic delay.
- Not wired into live Android capture yet. No channel-selection UI, dual-channel recording, per-channel calibration or hardware clock proof is claimed.
- Physical USB multichannel interface testing and comparison with a reference analyser remain required.


