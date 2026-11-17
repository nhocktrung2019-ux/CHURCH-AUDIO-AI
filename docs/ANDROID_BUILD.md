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

Snapshots save the values actually received on the device and can be exported as JSON. Snapshot restore is not enabled.

### Guarded input-channel writes (new, hardware validation required)

The Android plugin exposes a separate `writeGuarded` operation with an exact write allowlist for input channels 01–32 only:
- Channel fader: -90 to 0 dB. The plugin converts the dB value to the X32/M32's normalized OSC level representation.
- Channel ON/OFF and preamp polarity: integer 0/1.
- Preamp trim: -18 to 0 dB only; the protocol notes this parameter applies to digital sources only.
- EQ enable; four EQ bands' frequency (20–20,000 Hz), gain (-15 to 0 dB only; cut-only), and Q (0.3–10).
- Channel delay enable and delay time (0.3–200 ms).

Every write requires a successful read in the UI, a separate explicit user confirmation, and a second native read immediately before sending. The native bridge aborts when the just-read value no longer matches the value prepared by the UI. After sending, it issues another read and reports `verified` only when the console's reply matches the requested wire value. A sent-but-unverified packet is reported as uncertain; the app warns not to send it again until the mixer is checked.

The UI retains the previous verified value and offers a separately confirmed guarded restore for that one parameter. This is not a whole-scene restore. The write allowlist does not include bus/main/matrix changes, routing, phantom power, headamp gain, presets, scenes, or arbitrary OSC addresses. Fader/preamp/EQ gain increases are deliberately restricted in this phase.

No physical X32/M32 console has yet been available for hardware validation. CI confirms Java/TypeScript compilation and APK packaging only; it does not certify live OSC interoperability, firmware-specific parameter behavior, audible outcome, or the safety of a venue system. Keep amplifiers muted or at a low safe level while first validating with a real console, and do not use this control path during a live service until tested.
