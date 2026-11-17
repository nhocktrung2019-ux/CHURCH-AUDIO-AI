# Multi-source measurement and Vietnamese feedback alerts

## Feedback warnings

The general voice-command assistant, Web Speech Recognition and typed voice-command fallback are not part of the current application workspace.

The multi-source feedback monitor can optionally speak a Vietnamese warning using the device's speech-synthesis service. It is an operator notification only:
- It monitors persistent narrow spectral peaks for each separately captured input.
- A warning candidate requires at least 60% persistence and 5 dB prominence in the current detector.
- Repeated announcements for the same source/frequency bucket are rate-limited to 30 seconds.
- The warning names the input and approximate frequency, and tells the operator to lower the system level and inspect the microphone/monitor path.
- Speech synthesis can be disabled with the in-app checkbox. When unavailable, the visual Vietnamese warning remains.
- A narrow peak is not proof of an acoustic feedback loop. The operator must confirm by listening and controlled channel isolation.

No automatic mixer gain, mute, automix, ducker or hardware EQ action is triggered by a warning. Speech synthesis is not a control path and does not send commands to DSP or mixer devices.

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
6. Confirm every feedback candidate by listening and controlled channel isolation before making manual corrective changes.
7. Use a shared-clock multichannel interface, loopback reference and channel-separated driver for phase/delay/transfer-function work.
