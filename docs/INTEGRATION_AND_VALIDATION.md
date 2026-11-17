# Integration and validation

### v0.21.0-beta.1 — multichannel PCM preservation

- Request up to two input channels when supported; do not force the browser capture to mono.
- AudioWorklet sends frame-major interleaved Float32 PCM with exact frame count, channel count and render-frame position.
- Main thread rejects channel-count changes, malformed payload sizes, missing frames and sample-rate mismatches.
- The current H1 analyzer still performs an explicit arithmetic-mean downmix after capture. It does not yet calculate a true Reference CH1 / Measurement CH2 transfer function.
- ScriptProcessor fallback remains mono-mixed and is not an equivalent multichannel path.
- Validate USB interface channel mapping, Android WebView channel preservation, sustained capture and actual loopback routing on physical hardware before promoting the beta.

