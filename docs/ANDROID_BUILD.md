# Android APK build

The Android wrapper is generated from the Vite web application using Capacitor 7.

## Automated build
1. Push to `main` or open GitHub Actions and run **Android APK** manually.
2. Wait for the workflow to finish.
3. Open the successful run and download the `church-audio-analyzer-debug-apk` artifact.
4. Extract the ZIP and install `app-debug.apk` on an Android device. Allow installation from that source if Android asks.

The generated Android manifest declares both `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS`, which the Capacitor WebView microphone permission flow requires. This workflow creates a **debug APK** for testing, not a signed Play Store release. A production release needs a private signing key and protected GitHub Actions secrets.

## Local build
Requires Node.js 22 and JDK 21.

```bash
npm install
npm run build
npm run android:add
npm run android:sync
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Audio limitations
Microphone capture requires Android microphone permission and a secure runtime. Bluetooth and USB audio routing depend on Android device support and are not guaranteed by browser device enumeration. Calibrated SPL, RT60, transfer-function phase, delay alignment and automatic feedback suppression require validated measurement procedures and suitable hardware; do not treat uncalibrated phone-microphone readings as certified measurements.


## X32 / M32 network monitor (Android, read-only phase)

The Android Capacitor plugin sends OSC query packets over UDP to the configured console IP and port (default 10023). It accepts only private/link-local IPv4 destinations and an explicit allowlist of read-only OSC paths. Query packets contain no value arguments.

The monitor can read:
- Console identity/status: `/info`, `/xinfo`, `/status`.
- Input channels 01–32: name, fader, on/off, pan, preamp trim, EQ enable, dynamics enable; selected-channel detail includes supported preamp, gate, dynamics and four-band EQ parameters.
- Mix buses 01–16, Main Stereo/Mono, Matrix 01–06, Aux inputs 01–08, FX returns 01–08 and DCA 01–08: supported name, fader/on state, pan where applicable, EQ/dynamics enable; selected-strip detail reads additional supported EQ/dynamics values.
- Batch reads are limited to 64 allowlisted paths per native call; the UI sends smaller groups to reduce UDP packet loss. Live Monitor polls the selected strip at a two-second interval while the screen is active.

The native receiver validates the source IP, not a fixed source port: OSC consoles may send replies to the phone's ephemeral UDP source port. Unrelated/malformed datagrams are ignored, and the receiver waits until the configured overall timeout.

Snapshots save the values actually received on the device and can be exported as JSON. A snapshot is a measurement/state record only; there is no restore/write command yet. No fader, mute, gain, EQ, routing, preset, scene, or DSP parameter write is enabled. No physical X32/M32 console has yet been available for hardware validation; a successful CI build verifies compilation and packaging, not live console interoperability.
