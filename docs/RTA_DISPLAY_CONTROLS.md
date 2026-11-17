# RTA display controls — advanced workspace

## Sensitivity (display scale only)

The three RTA sensitivity settings define the visible lower dBFS floor. They do not change microphone preamp gain, OS input gain, raw FFT values, or the numeric level reading.

| Setting | Visible floor | Use |
|---|---:|---|
| High / Cao | -100 dBFS | Inspect low-level detail and room/noise tails |
| Medium / Vừa | -85 dBFS | General tuning and day-to-day operation |
| Low / Thấp | -70 dBFS | Focus on stronger energy and reduce visual clutter |

A value below the selected display floor is not drawn. It is not deleted from the audio measurement stream.

## Update speed

| Setting | Nominal analysis cadence | Smoothing |
|---|---:|---|
| Fast / Nhanh | about 30 frames/s | lowest |
| Medium / Vừa | about 15 frames/s | medium |
| Slow / Chậm | about 7.5 frames/s | highest |

The cadence is nominal and depends on the host display/requestAnimationFrame rate. Slower operation reduces UI/CPU work and increases visual averaging; it does not change the microphone sampling rate or FFT size.

## Spectrum and measurement interpretation

- The spectrum uses a multicolor level ramp to improve visual discrimination between low and high energy.
- The analyzer retains the configured 8192-point FFT and 64 logarithmically spaced display bands.
- dBFS is a digital level reference. It is not SPL unless a microphone calibration and acoustic reference chain have been applied.
- The display settings do not validate phase, coherence, acoustic feedback, or loudspeaker response on their own.
- Use the selected frequency cursor and saved feedback-frequency notes as technician aids, not as automatic EQ instructions.

## Device library

The mixer/DSP catalogue offers category, product-family and exact-model selection for worksheets. A selected model is written into the exported JSON worksheet. All devices remain manual-only until a supported protocol/API, device/firmware mapping, read-back verification, safe write path and real-device validation exist.
