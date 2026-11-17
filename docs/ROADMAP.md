# Roadmap and measurement integrity

This roadmap describes the integrated beta branch. “Implemented” means code and a workspace exist; it does not imply hardware validation, acoustic certification or live DSP control. See [the full acceptance plan](INTEGRATION_AND_VALIDATION.md) and [the consolidated six-stage roadmap](ROADMAP_FULL.md).

## Stage 1 — Audio engine and routing
- [x] Browser/WebView microphone capture and device enumeration where exposed by the platform.
- [x] Signal generator, input level monitoring and input/output selection where supported.
- [x] USB/OTG and Bluetooth route labelling when the operating system provides identifying names.
- [ ] Physical Android tests for permissions, disconnect/reconnect, sample-rate changes, route switching, latency and long-session stability.

## Stage 2 — Acoustic measurement
- [x] Log-frequency RTA, selectable frequency cursor, spectrum history and spectrogram/waterfall.
- [x] Z/A/C-weighted level estimates, elapsed-time Leq integration and calibration workspaces.
- [x] Sweep-based impulse response and RT60/T20/T30 estimates with fit/noise indicators.
- [x] Transfer-response and phase-shape/coherence diagnostics, plus conservative cut-only PEQ suggestions.
- [ ] Reference-analyser comparison with a calibrated microphone and known audio interface.
- [ ] Sample-synchronous dual-channel loopback/reference capture and latency characterization for absolute transfer, phase and delay claims.

## Stage 3 — Feedback and multi-source measurement
- [x] Persistent narrow-peak candidates, saved suspect feedback points and conservative advisory notch values.
- [x] Attempted independent capture of up to four separately enumerated inputs, with per-source RTA histories.
- [x] Vietnamese visual feedback warnings and optional speech synthesis for persistent narrow peaks; general voice-command recognition is not included.
- [ ] Validate concurrent capture on target Android devices and identify channels inside multichannel USB interfaces.
- [ ] Confirm candidate feedback by listening and physical channel isolation before any EQ action.

## Stage 4 — Room and loudspeaker design
- [x] Interactive Three.js church room planner with speaker placement and approximate coverage visualisation.
- [x] CBT planning and polar-data import/inspection tools.
- [ ] Validate room dimensions against a site survey and coverage against measured audience positions.
- [ ] Populate verified manufacturer polar/phase data for each exact model, configuration and frequency.

## Stage 5 — DSP and mixer model catalogue / integration
- [x] Selectable manual configuration profiles for Behringer X32/WING/X AIR, Midas M32/HD96, Yamaha mixers/installation DSP, Soundcraft Ui/Si/Vi, dbx DriveRack and db Acoustics CD48.
- [x] Export proposed channel map, HPF, relative delay and technician notes for review.
- [ ] Exact model/firmware adapters with documented protocols, state read-back, validation, confirmation and rollback.
- [ ] Physical hardware bench tests before enabling any control/write capability.

## Stage 6 — Versioning, support and release
- [x] Version/update workspace linked to private GitHub Releases.
- [x] Privacy-conscious technical diagnostic report and support issue template.
- [x] Tag-triggered signed APK release workflow.
- [ ] Configure the permanent Android signing keystore secrets in repository settings.
- [ ] Test signed install/update and backup/restore on target Android hardware.

## Measurement integrity and safety
- Browser dBFS is digital level, not calibrated SPL.
- Absolute SPL requires the full input chain, an appropriately calibrated measurement microphone and a known acoustic calibrator.
- Absolute delay and production-grade dual-channel transfer measurements require simultaneous reference/loopback and microphone channels on a shared hardware clock, with latency characterized.
- Multi-source spectra are relative overviews unless every channel is independently calibrated and sample-synchronous. They are not phase-coherent sums.
- A narrow spectral peak is a feedback candidate, not proof of an acoustic feedback loop. The app must not automatically raise gain or write EQ/mute settings to a live system.
- CBT/room coverage views are planning estimates, not a replacement for official JBL CBT Calculator, EASE Focus or a verified GLL/CLF-based prediction workflow.
- Do not claim IEC 61672 sound-level-meter or ISO 3382 room-acoustic compliance from a phone/browser chain.
- Start test tones at low level, protect loudspeakers and hearing, and follow venue safety procedures.
