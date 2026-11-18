# Per-input microphone and SPL calibration

## Calibration layers (do not mix these values)

1. **Frequency-response correction**: a correction curve in dB to add to each logarithmic RTA band. Import only a manufacturer's or calibration-laboratory correction file for the exact microphone. The app interpolates logarithmically and leaves bins outside the measured range uncorrected.
2. **One-point SPL sensitivity/level offset**: calibrates the app's 1 kHz input-level estimator against a real acoustic calibrator. Each input device has its own profile. This is an offset for the complete microphone + preamp/interface + OS capture route, not a microphone-only sensitivity value.
3. **Electrical input/output loopback calibration**: the separate channel calibration used for synchronous transfer/phase/delay. It is not interchangeable with acoustic microphone calibration.

## One-point acoustic calibration procedure

1. Select the exact input device that will be measured. Keep the same microphone, preamp/interface, phantom-power state, gain, sample rate, USB/OTG route and Android audio route.
2. Disable AGC, echo cancellation and noise suppression where the platform permits. The app requests these options off, but Android/WebView may ignore them; check the input diagnostics and repeatability.
3. Attach a calibrated acoustic calibrator directly to the microphone using the correct coupler. Do not hold a loudspeaker near the microphone and do not use a phone-generated tone as the reference.
4. Use the calibrator's stated 1 kHz level (94 dB SPL or 114 dB SPL). Choose the matching reference in the app.
5. Start capture and wait for the rolling 1 kHz spectral estimate to settle. Keep the signal unclipped and within the accepted -80 to -3 dBFS calibration window and comfortably above the noise floor. Save the offset for this exact input.
6. Remove and reseat the calibrator, repeat the check, and confirm the displayed result returns to the calibrator's reference level. If gain, interface, sample rate, device ID or route changes, recalibrate.
7. For frequency response, separately import the exact microphone correction file. A one-point offset cannot flatten a microphone's frequency response.

## Calculation and limits

The application estimates the mean linear power of FFT bins around 1 kHz, expressed as dBFS. It stores:

`offset_dB = reference_dB_SPL - measured_1kHz_dBFS`

and displays:

`estimated_dB_SPL = measured_dBFS + offset_dB`

The estimator averages recent frames to reduce display jitter. It does not compensate for calibrator tolerance, coupler leakage, microphone orientation, preamp nonlinearity, ADC clipping, frequency weighting, time weighting, self-noise or OS processing. The result is a one-point calibrated estimate, not an IEC 61672 Class 1/2 instrument certification. It is not valid for another input route or sample rate.

## Acceptance gates

- Verify each USB/OTG, Bluetooth and built-in input independently; do not assume their offsets are shared.
- Repeat the 94/114 dB reference check after disconnect/reconnect and after changing gain or sample rate.
- Compare against a trusted sound level meter at 1 kHz and several broadband levels.
- Verify linearity at more than one calibrator level where equipment permits.
- Confirm correction files come from a traceable measurement for the exact microphone model/serial.
- Keep raw dBFS, applied offset, input ID, sample rate and calibration timestamp available for diagnostics.
- Physical Android, microphone, calibrator and reference-meter acceptance is still required; CI cannot prove acoustic accuracy.
