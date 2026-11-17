# Church Audio Analyzer

A measurement-first audio analysis and system-tuning workspace for church sound systems. Targets: Android and laptop/desktop browsers.

## MVP
- Live audio input selection using the Web Audio API.
- FFT spectrum (RTA-style) and peak digital level meter.
- Signal generator: sine, white noise, pink noise and logarithmic sweep.
- Measurement workspaces for RTA, spectrogram/waterfall, calibrated response correction, Z/A/C-weighted level estimates and Leq integration.
- Sweep-based RT60/impulse-response analysis, Welch-averaged transfer response, coherence, phase-shape/polarity diagnostics and cut-only PEQ export.
- CBT planning, manufacturer polar CSV inspection, room/speaker coverage schematic and local project backup/restore.
- Audio input/output device enumeration where supported.
- Responsive Vietnamese-first interface.

## Measurement integrity
- Browser microphone readings are uncalibrated unless a calibrated microphone and calibration profile are used.
- Phone microphones are suitable for preliminary checks, not precision acoustic certification.
- Advanced RT60, transfer function, phase, Auto EQ, feedback and loudspeaker-coverage modules are implemented as engineering aids, but their output must be validated with the correct measurement chain and manufacturer data. The built-in CBT/room coverage model is an approximation, not a replacement for JBL CBT Calculator or EASE Focus.
- Start test tones at low level and follow venue safety procedures.

## Run locally
Requires Node.js 20+.

```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Android APK
Android packaging is configured with Capacitor. A GitHub Actions workflow builds a debug APK on pushes to `main` and can also be started manually. The build is an Android test build, not a signed Play Store release. See [Android build and install guide](docs/ANDROID_BUILD.md). The APK is a test build, not a signed Play Store release.

## Measurement scope and limits
- Absolute SPL requires a real acoustic calibrator and a calibrated measurement microphone. Import the mic correction file and set the one-point level offset.
- Absolute loudspeaker delay and production-grade dual-channel transfer function require simultaneous, sample-synchronous loopback/reference and microphone channels on a shared clock.
- RT60 is estimated by sweep deconvolution and Schroeder decay; repeat at multiple positions and review the fit/noise metrics.
- CBT and room predictions are not certified EASE/GLL calculations. Use validated manufacturer GLL/CLF/polar/phase data and the official vendor tools for design approval.

## Platform plan
The application remains a responsive web app for laptop browsers and is wrapped for Android with Capacitor. Hardware-specific USB/Bluetooth routing requires device-by-device testing.

See [docs/ROADMAP.md](docs/ROADMAP.md).

Audio input routing and delay-measurement limitations are documented in [docs/AUDIO_INPUT_AND_DELAY.md](docs/AUDIO_INPUT_AND_DELAY.md). JBL COL600/COL800 profile records are staged in [src/data/speakers/jbl-col-series.json](src/data/speakers/jbl-col-series.json); manufacturer curves/specifications remain pending exact datasheet verification.

## Version updates and technical support

Current application version: **0.12.0**. The in-app **Cập nhật & hỗ trợ** workspace opens GitHub Releases, provides Android update instructions, and can generate a privacy-conscious diagnostic report for a support request. The repository is private, so users need GitHub access to download releases.

Official APK releases are built by [Android Signed Release](.github/workflows/android-release.yml) when a `vX.Y.Z` tag is pushed. Configure the four Android signing secrets before tagging a release; keep the signing keystore safe and unchanged. See [Android update and signing guide](docs/ANDROID_UPDATE.md) and [technical support guide](docs/TECHNICAL_SUPPORT.md). CI debug APKs are for testing and are not the stable update channel.
