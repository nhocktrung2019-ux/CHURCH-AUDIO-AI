# Technical support

## Before opening a support request

1. Record the application version shown in **Support**.
2. Confirm the Android version or desktop browser/WebView version.
3. Note the measurement workspace and exact action that failed.
4. Record the expected result and the result actually observed.
5. Open **Support → Create & copy report** or download the TXT report. Review it before sharing.

## What the diagnostic report contains

The report includes the app version, Capacitor platform, timestamp, online and secure-context flags, browser user agent, Web Audio API availability, and counts of enumerated audio inputs/outputs.

It does not request microphone permission, record audio, or include device names, device IDs, credentials, access tokens, project files, or calibration data. Device counts can be unavailable when the platform blocks device enumeration.

## Common audio-input problems

### Microphone permission denied

- Android: Settings → Apps → Church Audio Analyzer → Permissions → Microphone → Allow.
- Close and reopen the app, then refresh the device list.
- Check that another application is not exclusively holding the audio interface.

### USB / OTG device not visible

- Confirm the adapter supports USB host/OTG and the interface is class-compliant.
- Connect the interface before opening the measurement workspace.
- Android and the WebView determine which USB audio routes are exposed; a connected device is not guaranteed to appear as a browser audio input.
- Use a wired measurement chain for reliable phase, response and delay work.

### Bluetooth microphone has poor measurement quality

Bluetooth hands-free audio can use bandwidth limits, automatic gain control, noise suppression, resampling and variable latency. Use it only for preliminary checks, not calibrated SPL, phase or absolute delay certification.

### APK cannot update an installed app

Android rejects an APK whose signing certificate differs from the installed package. Back up project data before uninstalling. Follow [ANDROID_UPDATE.md](ANDROID_UPDATE.md) and do not delete the stable release keystore.

## Open a request

Use the repository's **Technical support** issue form. Include:

- App version and platform.
- Measurement workspace and action.
- Reproduction steps.
- Expected and actual behavior.
- A reviewed diagnostic report, when useful.

Do not include passwords, access tokens, private audio recordings, congregation/member information, or other sensitive data in GitHub Issues.
