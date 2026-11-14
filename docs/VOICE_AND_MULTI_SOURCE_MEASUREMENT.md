# Voice assistant and multi-source measurement

## Voice assistant

- Speech commands are supported through the browser/WebView Web Speech Recognition API when the platform exposes it. The recognition locale is Vietnamese (vi-VN).
- Commands: scan microphone inputs, start a multi-source measurement, stop the measurement, read the current report, and request help.
- Spoken reports use SpeechSynthesis with a Vietnamese voice when the platform provides one. A typed-command fallback remains available if speech recognition is not supported.
- The current assistant parses a limited set of local intents and summarizes measured RTA/feedback indicators. It is not a connected cloud LLM and does not send captured audio or measurement data to an AI provider.
- Speech recognition availability, network use, and privacy behavior depend on Android WebView and its configured speech service. Operators should review the device's speech-service privacy settings.

## One measurement with multiple sources

The panel lets the operator select up to four separately enumerated audioinput devices. Each selected device is opened as its own getUserMedia stream and analyzed in the same application session. Every source retains an independent 64-band logarithmic RTA history and advisory peak list.

A composite display is computed by converting each source band from dBFS to linear power, averaging the powers, and converting the result back to dB. It is a relative overview only. It is not a phase-coherent sum, calibrated SPL measurement, transfer function, or proof that sources share a hardware clock. Input sensitivity, frequency response, latency, and OS signal processing can differ between sources.

## Hardware and measurement limitations

- Concurrent capture depends on Android audio HAL, WebView, interface driver and firmware. Some devices permit only one capture session.
- A single USB multichannel interface may appear as one audioinput device. This beta cannot yet select individual hardware channels inside that one device.
- Separate USB interfaces may use independent clocks. The application session updates their analysis together, but does not guarantee sample-accurate synchronization.
- Calibrate each microphone/input chain independently before comparing absolute SPL. A shared calibration offset is not sufficient for microphones with different sensitivities.
- Do not use the composite spectrum for phase, delay, coherent array summation, RT60 certification, or absolute SPL. Use a clock-synchronous multichannel interface and a dedicated channel-aware/native audio engine for those tasks.
- The application does not change mixer gain, mute, automix, ducker, or hardware EQ.

## Recommended workflow

1. Connect measurement microphones/interface and grant microphone permission.
2. Scan devices and select only the inputs needed for this session.
3. Start with low PA/monitor levels and verify every independent channel has signal.
4. Check each source's level and spectrum separately; use the composite graph only as a quick shared overview.
5. Calibrate every measurement chain before comparing SPL.
6. Use a shared-clock multichannel interface, loopback reference and channel-separated driver for phase/delay/transfer-function work.
