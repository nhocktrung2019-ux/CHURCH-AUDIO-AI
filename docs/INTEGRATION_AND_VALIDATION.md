# Full development roadmap and validation gates

This document separates implemented beta capabilities from hardware-dependent work that must be validated before a production claim.

## Stage 1 — Audio Engine and device routing

**Implemented in the current integration branch**
- Browser/WebView microphone capture using Web Audio.
- Input/output enumeration where the platform exposes devices.
- Signal generator and level monitoring.
- USB/OTG and Bluetooth input labels where device names allow.

**Acceptance still required**
- Test on target Android phones/tablets and representative USB interfaces.
- Verify permission denial/recovery, device detach/reconnect, route changes, sample-rate changes and long-session stability.
- Measure actual input/output latency; do not infer absolute latency from UI scheduling.

## Stage 2 — Acoustic measurement engine

**Implemented beta workspaces**
- Log-frequency RTA, selectable frequency cursor, spectrogram/waterfall and level/Leq tools.
- Sweep-based impulse response and RT60 estimates.
- Transfer response, coherence and phase-shape diagnostics.

**Acceptance still required**
- Compare against a calibrated reference analyser and repeat with documented microphone/interface settings.
- Require a clock-synchronous loopback/reference input for absolute transfer, phase and delay.
- Inspect clipping, SNR, decay range, curve fit and uncertainty at every measurement location.
- Do not claim IEC 61672 or ISO 3382 compliance from a browser/phone measurement chain.

## Stage 3 — Feedback monitoring and AI assistance

**Implemented beta workspaces**
- Persistent narrow-peak candidates with conservative notch suggestions.
- Multi-source capture attempts for up to four separately enumerated input devices.
- Vietnamese voice-command intents, speech summaries and typed-command fallback.

**Acceptance still required**
- Confirm peaks by listening and isolating the physical microphone/channel.
- Test concurrent capture behavior per Android device and USB interface.
- Distinguish independent device streams from hardware channels inside one multichannel interface.
- Keep all EQ/gain/mute writes disabled until model-specific DSP adapters are validated.

## Stage 4 — 3D room and loudspeaker design

**Implemented beta workspaces**
- Interactive Three.js church-room planning scene, loudspeaker placement and approximate coverage views.
- CBT and polar-data utilities.

**Acceptance still required**
- Validate geometry and scale against a surveyed room.
- Import manufacturer polar/phase data for the exact model, configuration and frequency.
- Validate prediction against measured coverage at multiple listener positions.
- Treat the current view as a planning aid, not EASE Focus, GLL simulation or certified ray tracing.

## Stage 5 — DSP and mixer integration

**Implemented in this branch**
- Model-family catalog and manual configuration worksheet for X32/M32, Soundcraft, dbx DriveRack and db Acoustics CD48.
- JSON export of proposed channel mapping, HPF, relative delay and technician notes.
- A hard boundary preventing the UI from claiming live connection or writing settings.

**Acceptance still required**
- Build a separate adapter for each exact model and firmware using an official protocol.
- Add discover/read/validate/apply/read-back/rollback methods.
- Test on physical hardware and require per-change operator confirmation.

## Stage 6 — Versioning, support and release

**Implemented in this branch**
- Version and update workspace linked to private GitHub Releases.
- Privacy-conscious diagnostic report that omits audio recordings, device names and device IDs.
- Technical support issue form and troubleshooting guides.
- Tag-triggered signed-release workflow.

**Acceptance still required**
- Configure and protect the permanent Android keystore secrets in repository settings.
- Keep package.json and src/appVersion.ts aligned for each stable tag.
- Test signed install/update on the target device and verify backup/restore.
- The in-app update workspace opens GitHub Releases; it does not silently install APKs or bypass private-repository access.

## Cross-stage release gates

- Automated regression tests and TypeScript/Vite build pass.
- Android debug APK packages successfully.
- Real-device smoke tests pass for each supported Android version and audio interface.
- Measurement results are compared with reference equipment; uncertainty and unsupported claims remain visible.
- Release APK is signed with the permanent keystore; secrets are never committed to source.
- Project backup/restore and privacy behavior are verified.
