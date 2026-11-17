# Multi-microphone feedback monitoring

## Current beta behavior

The Multi-Mic Feedback Watch lists separately enumerated audioinput devices after the operator grants microphone permission. The operator chooses up to four devices and starts capture. The app attempts one independent getUserMedia session per selected device and computes an independent 64-band log RTA history for each stream. Persistent narrow spectral peaks are advisory candidates only.

## Hardware and platform constraints

- Concurrent capture is dependent on the Android audio HAL, WebView/browser, USB interface driver and device firmware. Some Android devices permit only one capture session; the panel reports individual open failures.
- A multichannel USB interface may enumerate as one audio input with several hardware channels. This beta does not yet select channels inside one device; it only opens separately enumerated input devices.
- A stereo mixdown cannot identify which physical microphone caused feedback. Use a mixer/interface that exposes isolated inputs or channel sends.
- Browser/WebView audio capture may still be affected by OS processing despite requesting echo cancellation, noise suppression and AGC off.
- This is analysis only. The app does not control mixer mute, gain, automix, compressor, gate or EQ.

## Safe operator workflow

1. Lower PA and monitor output before opening microphones.
2. Scan devices, select separately enumerated inputs and verify each channel has signal.
3. Open microphones one at a time and establish gain-before-feedback.
4. When a narrow peak appears, listen and mute/solo the suspected physical channel at the mixer to confirm the source.
5. Correct microphone placement, speaker aiming, monitor routing and channel gain before applying a small, narrow EQ cut on the confirmed channel.
6. Recheck with the actual combination of open microphones and normal service levels.

Never rely on a spectral peak alone as proof of feedback and never apply automatic cuts during a live service without operator confirmation.
