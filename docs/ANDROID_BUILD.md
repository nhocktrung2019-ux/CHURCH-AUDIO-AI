# Android APK build

The Android wrapper is generated from the Vite web application using Capacitor 7.

## Automated build
1. Push to `main` or open GitHub Actions and run **Android APK** manually.
2. Wait for the workflow to finish.
3. Open the successful run and download the `church-audio-analyzer-debug-apk` artifact.
4. Extract the ZIP and install `app-debug.apk` on an Android device. Allow installation from that source if Android asks.

This workflow creates a **debug APK** for testing, not a signed Play Store release. A production release needs a private signing key and protected GitHub Actions secrets.

## Local build
Requires Node.js 22 and JDK 21.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Audio limitations
Microphone capture requires Android microphone permission and a secure runtime. Bluetooth and USB audio routing depend on Android device support and are not guaranteed by browser device enumeration. Calibrated SPL, RT60, transfer-function phase, delay alignment and automatic feedback suppression require validated measurement procedures and suitable hardware; do not treat uncalibrated phone-microphone readings as certified measurements.
