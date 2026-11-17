# Changelog

## 0.20.0-beta.1 — Synchronous dual-channel measurement foundation

- Add strict provenance validation for Reference/Measurement channel pairs: same capture session, source stream, sample rate, frame start/count and distinct channel indices.
- Add a planar PCM channel extractor that rejects incomplete or mismatched frame ranges.
- Add a bounded broadband cross-correlation delay estimator with documented sign convention (positive means Measurement arrives later than Reference).
- Add regression tests for independent clocks/streams, mismatched frame ranges, channel mapping, extraction and known-delay signals.
- This is algorithmic groundwork only. Live dual-channel USB capture, channel-selection UI, per-channel calibration and hardware clock verification are not yet enabled.


## 0.19.0-beta.1 — PCM metadata and channel integrity

- Distinguish the number of physical input channels from the one-channel mono PCM payload used by the current Transfer Function analysis.
- Include exact frame count, PCM channel count, input channel count and byte length in each AudioWorklet block; reject inconsistent metadata before analysis.
- Detect input channel-count changes, input disappearance and AudioWorklet render-clock jumps during capture.
- Persist capture engine, channel-mix policy and track-reported channel/sample-rate settings with each measurement.
- Keep multi-channel phase/delay alignment disabled: this version does not implement synchronous dual-channel capture.

## 0.18.0-beta.1 — AudioWorklet PCM engine

- Add a dedicated AudioWorklet processor that transfers raw Float32 PCM blocks with AudioContext frame positions; no MediaRecorder codec path is used.
- Detect dropped, duplicated or out-of-order PCM frames using the audio render clock and reject discontinuous sessions.
- Retain a clearly labeled ScriptProcessor compatibility fallback for older Android WebView builds; fallback is not treated as the preferred measurement engine.
- Preserve conservative Auto EQ gates and advisory-only DSP output.
- Keep absolute A/B delay disabled until simultaneous channels from one shared-clock multichannel interface and per-channel calibration are verified.

## 0.17.0-beta.1 — Raw PCM, Auto EQ quality gate and phase alignment

- Replace compressed MediaRecorder capture in Transfer Function with raw Float32 PCM blocks from the Web Audio graph.
- Track PCM RMS, peak, clipping and invalid-sample percentage; reject discontinuous capture sessions before analysis.
- Compensate the known playback pre-roll when reporting total relative path latency.
- Gate Auto EQ on in-band bin count, coherence coverage, raw-capture headroom and clipping checks.
- Keep PEQ suggestions cut-only, capped at 4 dB, limited to six separated filters and exported as an advisory JSON worksheet.
- Improve A/B crossover comparison with nearest-frequency pairing, coherence weighting and circular phase averaging.
- Add a phase-slope delay estimator that refuses results unless simultaneous capture, common hardware clock, per-channel calibration and characterized latency are all declared.
- Add regression tests for Auto EQ, phase/polarity comparison, synchronous delay gating, PCM quality and known pre-roll compensation.


## 0.16.0-beta.1 — Feedback confidence and measurement reliability

- Calculate persistence against each RTA frame's own local spectral floor to reduce sensitivity to slow ambient-noise changes.
- Require valid neighboring bins and enough usable frames before publishing a feedback candidate.
- Keep one representative for flat-topped peaks and reject non-local maxima to reduce duplicate warnings.
- Show persistence percentage and advisory confidence in Feedback Watch; no automatic EQ or gain changes are introduced.
- Add regression coverage for stable peaks, transient spikes, flat-top peaks and incomplete/invalid histories.

## 0.14.0-beta.4 — Voice assistant and multi-source measurement

- Add Vietnamese voice commands for scanning inputs, starting/stopping a multi-source session, and reading a spoken measurement summary.
- Add typed-command fallback when Web Speech recognition is unavailable in the Android WebView.
- Capture up to four separately enumerated inputs in one software measurement session, preserving independent RTA histories per source.
- Add a linear-power average spectrum overview across active sources; label it as relative and non-phase-coherent.
- Document clock, calibration, Android concurrent-capture, and single multichannel-USB-device limitations.


## 0.13.0-beta.3 — Independent multi-microphone feedback watch

- Add an operator-controlled input scan and selection for up to four separately enumerated microphone devices.
- Attempt independent capture sessions per selected input, with per-device RTA history and persistent narrow-peak warnings.
- Report device-specific capture failures instead of fabricating channels; document Android/WebView and USB multichannel limitations.
- No automatic mute, gain changes, EQ writes or mixer control.


## 0.13.0-beta.2 — Room listening, natural EQ & feedback safety

- Add playback of the recorded RT60 sweep capture so operators can listen to the measured room tail.
- Improve persistent narrow-peak detection with median profiles, persistence/confidence scoring and conservative notch starting points.
- Add speech/music tuning presets and natural-sound guidance: modest cuts, no automatic EQ writes, no gain increase.
- Document safe multi-microphone workflow and the current single-input limitation; independent simultaneous mic analysis requires a multichannel interface/mixer feed.


## 0.12.0 — Update Center & Technical Support

- Add an in-app version and update center linked to GitHub Releases.
- Add signed Android release workflow with stable-keystore secrets and semantic version metadata.
- Add technical-support workspace with diagnostic report copy/download.
- Add a structured GitHub issue form and troubleshooting guides.
- Clarify first-install migration from transient CI debug signing to a stable release signing key.

## 0.11.0

- Add advanced measurement workspaces, calibration tools, transfer-function diagnostics and room/system planning.
