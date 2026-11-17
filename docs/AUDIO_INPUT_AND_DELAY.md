# Audio input and delay measurement design

## Supported input paths

The application enumerates browser-visible `audioinput` devices and requests the selected device by its `deviceId`. On Android this can expose:

- Built-in handset microphone.
- Bluetooth headset microphone, when Android routes it as a recording input and the WebView/browser exposes it.
- USB Audio Class microphone or USB audio interface connected through a USB-OTG adapter, when Android grants access and the interface is supported.

Device availability is controlled by Android, the USB interface, the WebView and the audio routing policy. A paired Bluetooth device is not necessarily an available recording input. The UI must show only inputs returned by `enumerateDevices()`, refresh after `devicechange` and app resume, and retain the existing default-input fallback when a selected device disappears.

## Measurement quality and routing guidance

1. Prefer a wired USB audio interface for acoustic measurements.
2. For a measurement microphone, use a suitable low-noise preamp and phantom power only when the microphone requires it. Check the interface's input mode and gain before measuring.
3. Import the microphone calibration file for the exact microphone and orientation. A generic phone or headset microphone must not be presented as calibrated.
4. Bluetooth microphones are suitable for rough checks and convenience. Bluetooth hands-free profiles may narrow the bandwidth, apply noise suppression/AGC, resample audio and add variable latency. Do not certify SPL, frequency response, phase or absolute speaker delay from an uncharacterized Bluetooth path.
5. Display the active track label, sample rate, channel count and actual selected route. Warn when browser track settings do not confirm the requested sample rate or channel count.

## Delay measurement modes

### Relative acoustic arrival estimate (single input)

A single microphone capture can estimate the arrival time of a known test signal by correlation/deconvolution. The result includes the complete playback, acoustic propagation, microphone, ADC, operating-system and codec path. It is a relative estimate, not an absolute loudspeaker DSP delay. Repeat measurements without changing the route or gain; use a wired input and fixed playback route.

### Absolute dual-channel transfer measurement (recommended)

For production alignment, capture the electrical reference/loopback and measurement microphone simultaneously through two inputs sharing one hardware clock. Estimate transfer function, impulse response, coherence and relative delay from the synchronized channels. A separate Bluetooth reference or independently clocked USB devices must not be treated as sample-synchronous.

### Alignment workflow

- Measure each loudspeaker at the same microphone position and preserve the same playback and input gain.
- For main/sub or main/fill, capture both sources in a synchronized dual-channel setup, or use a documented acoustic reference procedure with its uncertainty shown.
- Report delay in milliseconds and samples, sample rate, correlation peak, confidence/coherence, input device and measurement mode.
- Convert distance to expected acoustic time using the configured speed of sound; do not silently treat this estimate as measured DSP delay.
- Never apply delay or polarity changes automatically. Present the recommendation for operator review and re-measure after adjustment.

## UI requirements

- Input selector groups devices as Built-in, Bluetooth and USB/External when labels allow reliable classification; otherwise use the device's actual label and an Unknown group.
- Provide a Refresh devices action and a System default option.
- Show an explicit warning if a requested device falls back to the system default.
- Add an input quality panel: sample rate, channels, track label, calibration profile, clipping and input stability.
- Delay results must label the measurement mode and limitations. Disable "absolute delay" claims unless synchronized dual-channel reference capture is verified.
