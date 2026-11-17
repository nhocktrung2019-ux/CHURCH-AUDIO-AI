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


## X32 / M32 network control (Android, read-only phase)

The app includes a small Capacitor native UDP plugin for X32/M32 OSC read requests. The installer script copies the Java plugin into the generated Android app, registers it in `MainActivity`, and adds Android's `INTERNET` permission. The Android APK workflow runs this installer automatically after Capacitor sync.

Only the following read-only OSC requests are accepted by the native plugin: `/info`, `/xinfo`, `/status`, selected channel name/fader/on/pan/preamp trim, and selected channel EQ enable/band values. Requests contain no OSC arguments. The plugin restricts destinations to private/link-local IPv4 ranges and uses a response timeout. No mixer write commands, mute changes, fader changes, EQ changes, preset loads, subscriptions, or background polling are implemented.

For an X32/M32 test, connect the Android device and console to the same LAN, enter the console's IP address, keep the console's OSC port at UDP 10023, and use the in-app **Read mixer info** action. This phase has not been validated against physical hardware; CI success confirms compilation only, not mixer connectivity.
