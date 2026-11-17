# Changelog

## 0.27.0-beta.1 — Spatial consistency diagnostics

- Add per-frequency multi-position diagnostics with position coverage, spatial spread and an explicit included / insufficient-coverage / spatial-variance status.
- Surface the highest-variance and under-covered bins in the Auto EQ workspace instead of only reporting a total rejected-bin count.
- Add insufficient-coverage and spatial-variance counts to the summary and exported PEQ worksheet.
- Preserve the existing safeguards: minimum three positions, clean AudioWorklet mono captures, unchanged signal-chain confirmation, high coherence, and cut-only PEQ. No automatic DSP writes.

**Validation status:** regression tests and Android debug packaging await CI. Real-room multi-position validation is still required.


## 0.26.0-beta.1 — Multi-position weighted Auto EQ

- Save up to eight named church listening positions with operator weights from 0.5 to 2.0; at least three positions are required.
- Require operator confirmation that the microphone, input/interface, gain, routing, loudspeaker system, processing and playback level are unchanged between positions.
- Accept only clean AudioWorklet mono-acoustic captures with valid PCM quality, coherent bins and matching sample rates. Reject synchronous loopback and legacy ScriptProcessor sessions.
- Interpolate in log-frequency space without extrapolating across gaps; require at least 80% position coverage per bin.
- Aggregate using operator weights after limiting outliers to median ±4 dB; omit bins with spatial spread above 8 dB rather than equalizing an inconsistent region.
- Feed the aggregate to the existing target-aware cut-only PEQ advisor. Export position names, weights and spatial spread summary. No automatic DSP/mixer writes are enabled.

**Validation status:** new regression tests and Android packaging await CI; physical multi-position validation is still required.


## 0.25.0-beta.1 — Target-aware Auto EQ

- Add selectable Flat / Spoken-word / Worship-music target contours for PEQ analysis.
- Interpolate contours on a logarithmic frequency axis and compare the measured response against the chosen operator reference.
- Keep strict readiness gates for coherent bins and raw PCM quality; synchronous dual-channel captures remain locked until per-channel ADC/DAC calibration is verified.
- Continue to generate cut-only PEQ suggestions (maximum 4 dB per filter, maximum six filters, frequency separation guard); never create boosts or write to connected DSP/mixer hardware.
- Include the target profile and its description in exported JSON worksheets.
- Label the profiles as mild starting references, not acoustic standards or universal room targets. Repeat measurements at multiple listening positions and verify by listening before manual use.

**Validation status:** this code change awaits its own CI run and Android debug packaging. Earlier v0.24.0-beta.1 CI passed and produced a debug APK artifact; no physical-device or hardware DSP tests are claimed.


## 0.24.0-beta.1 — Microphone dynamics advisor

- Add an offline starting-point calculator for soft-expander Gate, Compressor and Limiter settings for dynamic handheld and gooseneck microphones.
- Calculate thresholds from the operator-measured noise floor and speech peak, with conservative attack/hold/release, ratio, knee and limiter ceiling values.
- Warn when signal-to-noise margin is poor, speech peaks approach digital full scale, or background noise is high.
- Export the worksheet as JSON. No settings are sent to DSP or mixer hardware; dBFS references must be mapped to the exact device meter scale and confirmed by listening.
- Keep the v0.23 multicolour RTA, selectable speed/sensitivity, visual Vietnamese feedback alerts and model catalogue.

**Validation status:** regression tests, TypeScript/Vite build, Capacitor sync and Android debug APK packaging passed in CI run #368. No physical mixer/DSP or microphone test is claimed.

## 0.23.0-beta.1 — Multicolour RTA, Vietnamese feedback warnings and expanded DSP catalogue

- Add selectable RTA display sensitivity: High (-100 dBFS floor), Medium (-85 dBFS) and Low (-70 dBFS). These are display floors only; the captured PCM and underlying analysis values are unchanged.
- Add selectable RTA update response: Fast (~30 updates/s), Medium (~20 updates/s) and Slow (~10 updates/s), with matching analyser smoothing. Values depend on the device display refresh rate.
- Render 64-band RTA bars with a blue-to-red colour scale, peak emphasis, frequency/level tooltips and responsive controls that persist between sessions.
- Expand the manual DSP/mixer catalogue to named Behringer, Midas, Yamaha, Soundcraft, dbx and db Acoustics model families. Add exact model selection to the configuration worksheet/export.
- Remove both speech recognition and speech synthesis. Keep an operator-controlled Vietnamese on-screen feedback warning for persistent, prominent narrow peaks; each frequency warning is rate-limited.
- Keep all DSP/mixer profiles in manual/offline worksheet mode. No guessed network scan, direct mixer control, automatic EQ, gain, mute or routing writes are enabled.

**Validation status:** code and regression tests are added, but this beta has not yet been verified on physical Android devices, calibrated microphones, external reference analysers, or the listed DSP/mixer hardware. RTA sensitivity does not calibrate microphone sensitivity or SPL.

## 0.22.0-beta.1 — Synchronous dual-channel Transfer Function

- Add a dedicated synchronous loopback mode with Reference and Measurement input-channel selectors.
- Route the generated broadband signal to the selected AudioContext output when the browser exposes AudioContext.setSinkId; require the output to be selected explicitly for this mode.
- Require AudioWorklet and at least two channels from the same MediaStream; preserve discrete channel mapping and reject ScriptProcessor fallback for synchronous analysis.
- Calculate Welch H1, magnitude, phase and coherence from simultaneously captured channels without independently aligning the phase response.
- Estimate relative Reference-to-Measurement delay with reduced-rate coarse search and native-rate peak refinement to bound mobile CPU cost.
- Keep Auto EQ locked for synchronous captures until per-channel ADC/DAC and loopback calibration are available.
- Add synthetic regression tests for delay, gain, phase slope, coherence, silence and unrelated channels.

**Limitations:** The implementation requires a real electrical output loopback on the selected interface. It does not prove hardware ADC/DAC skew or calibrate input/output response. Physical Android USB acceptance and reference-analyser comparison remain release gates.


## 0.21.0-beta.1 — Multichannel PCM preservation

- Request two microphone channels when the selected device supports them; mono inputs remain supported.
- AudioWorklet now transports frame-major interleaved Float32 PCM without averaging away the input channels.
- Validate that PCM channel count matches the actual input channel count and that payload byte length matches frame/channel metadata.
- Explicitly downmix preserved channels only at the current mono H1 analysis boundary; keep capture metadata honest about raw channel count and downmix policy.
- Add regression coverage for interleaved PCM deinterleaving and mono downmix.
- This is not yet dual-channel Reference/Measurement analysis: the current H1 estimator remains mono, and USB interface routing/clock synchronization still require device validation.

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

