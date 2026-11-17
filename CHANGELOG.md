# Changelog

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
