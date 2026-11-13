# Church Audio Analyzer

A measurement-first audio analysis and system-tuning workspace for church sound systems. Targets: Android and laptop/desktop browsers.

## MVP
- Live audio input selection using the Web Audio API.
- FFT spectrum (RTA-style) and peak digital level meter.
- Adjustable sine-wave test signal.
- Audio input/output device enumeration where supported.
- Responsive Vietnamese-first interface.

## Measurement integrity
- Browser microphone readings are uncalibrated unless a calibrated microphone and calibration profile are used.
- Phone microphones are suitable for preliminary checks, not precision acoustic certification.
- RT60, transfer-function phase, delay alignment, feedback prediction and 3D coverage are planned; they are not claimed as completed measurements in this MVP.
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

## Platform plan
The first release is a responsive Progressive Web App for laptop browsers and Android Chrome. Native Android packaging and hardware-specific USB/Bluetooth routing follow after capability testing.

See [docs/ROADMAP.md](docs/ROADMAP.md).
