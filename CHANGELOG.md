# Changelog

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
