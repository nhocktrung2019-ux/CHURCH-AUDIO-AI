# Church Audio Analyzer

A Vietnamese-first measurement and system-tuning workspace for church sound systems. Targets Android through Capacitor and laptop/desktop browsers.

**Integrated beta branch version:** `0.23.0-beta.1`.

## Workspaces

- **Audio input/output and generator:** Web Audio microphone capture, available-device enumeration, sine/white/pink/log-sweep generator and digital level monitoring.
- **RTA and spectrum:** multicolour 64-band log-frequency RTA, selectable frequency cursor, adjustable display sensitivity (high/medium/low) and refresh response (fast/medium/slow), spectrum history, spectrogram/waterfall and saved frequency checkpoints.
- **Level and calibration:** Z/A/C-weighted estimates, elapsed-time Leq integration, microphone correction profiles and one-point SPL calibration workflow.
- **Room acoustics:** sweep-based impulse response and Schroeder decay analysis with RT20/RT30/RT60 estimates and fit/noise indicators.
- **Transfer and alignment:** transfer-response/coherence and phase-shape diagnostics, relative delay estimates and cut-only PEQ suggestions.
- **Feedback watch:** persistent narrow-peak candidates, Vietnamese visual warnings and optional Vietnamese spoken warnings, saved suspected feedback points and advisory notch recommendations.
- **Multi-source:** attempt independent capture of up to four separately enumerated inputs, per-source RTA histories and a relative linear-power overview; optional speech synthesis is reserved for feedback warnings, with no general voice-command assistant.
- **Church 3D and loudspeaker planning:** Three.js room layout, speaker placement, approximate coverage visualisation, CBT planning and polar-data inspection.
- **DSP and mixer catalogue:** selectable named models across Behringer X32/WING/X AIR, Midas M32/HD96, Yamaha digital mixers and installation DSP, Soundcraft Ui/Si/Vi, dbx DriveRack and db Acoustics CD48. The worksheet remains manual/offline; no generic model compatibility or live parameter writes are claimed.
- **Backup, update and support:** local project backup/restore, update links, device diagnostics and technical-support guidance.

## Build locally

Requires Node.js 20+.

```bash
npm install
npm test
npm run build
npm run dev
```

## Android APK

Android packaging is configured with Capacitor. The GitHub Actions pull-request workflow runs regression tests, builds the web app, synchronizes Capacitor and packages a **debug APK**. A debug APK is for testing, not a signed production release.

The tag-triggered signed-release workflow requires these repository Actions secrets to be configured before publishing: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Android requires the same signing certificate for in-place updates and user approval to install an APK. See [Android build](docs/ANDROID_BUILD.md) and [Android update procedure](docs/ANDROID_UPDATE.md).

## Measurement integrity and limitations

- Browser microphone readings are not calibrated SPL unless the entire input chain has been calibrated.
- A measurement microphone correction file and one-point acoustic calibrator offset solve different parts of the calibration process; both may be required.
- Bluetooth, phone microphones, AGC, echo cancellation, resampling and unknown latency can invalidate precision measurements.
- Multi-source capture only opens separately enumerated input devices. One multichannel USB interface that appears as a single device is not yet split into its individual hardware channels. Independent streams are not guaranteed to share a sample clock.
- Absolute transfer function, phase and delay require synchronous reference/loopback and microphone channels on a shared hardware clock, with latency characterized.
- Feedback peaks are advisory candidates. No automatic EQ, gain, mute or mixer write-through is enabled.
- DSP profiles are manual worksheets only; no direct connection or parameter writes to mixers/DSPs are enabled.
- The church 3D, CBT and coverage modules are planning aids and approximations. They are not a substitute for official JBL CBT Calculator or validated EASE Focus/GLL/CLF workflows.
- Do not claim IEC 61672 or ISO 3382 conformity from a phone/browser microphone chain.

See [the full six-stage roadmap](docs/ROADMAP_FULL.md), [integration and validation gates](docs/INTEGRATION_AND_VALIDATION.md), [acoustic workflow](docs/ACOUSTICS_ENGINE.md), [DSP integration boundaries](docs/DSP_INTEGRATION.md) and [voice/multi-source limitations](docs/VOICE_AND_MULTI_SOURCE_MEASUREMENT.md).
