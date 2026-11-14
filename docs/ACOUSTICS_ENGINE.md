# Church Audio Analyzer — Professional measurement workflow

This document distinguishes implemented analysis from measurement features that still require a calibrated acquisition chain or vendor simulation data.

## Workspaces

- Overview — live input/device state and measurement workflow.
- RTA — 64 logarithmic bands from 20 Hz to 20 kHz, spectrogram history, RMS/peak meters, Z/A/C-weighted estimates, integrated Leq, one-point SPL offset, and microphone correction-curve import.
- Room — logarithmic sine sweep, recorded impulse response deconvolution, octave-band Schroeder decay, T20/T30 extrapolation, fit R² and peak/noise indication.
- Align — Welch-averaged H1 magnitude estimate, coherence by frequency, time-aligned/unwrapped phase, relative path-delay estimate, A/B phase-shape/polarity comparison and conservative PEQ cut suggestions.
- System — feedback candidates and tuning suggestions.
- Design — CBT audience-plane calculator, polar-data import, room layout, coverage heatmap and distance-based delay estimate.
- Tools — signal generator, input/output selection, equipment library, project backup and restore.

## Microphone calibration

1. Connect the measurement microphone and select it in Tools / Device.
2. Import the manufacturer's microphone correction file in RTA / Microphone Frequency Calibration. The supported tabular format is two columns: frequency_hz,correction_db. Rows with non-numeric headings/comments are ignored. At least three points are required, with a recommended coverage of 50 Hz–10 kHz or wider.
3. The correction_db value must be the value to add to the measurement, not the raw microphone response. The app interpolates it logarithmically by frequency.
4. For absolute level, play a stable 1 kHz calibrator tone with a real acoustic calibrator (typically 94 dB SPL or 114 dB SPL), then apply the corresponding one-point offset in the SPL calibration panel.
5. Save the calibration and export a project backup.

A one-point acoustic level offset is not a substitute for the full frequency-response correction. The phone's internal microphone and ordinary USB headset microphones are not automatically calibrated.

## RT60 procedure

1. Stop the live RTA stream before starting a sweep.
2. Place the measurement microphone at a representative listening position, with the intended orientation.
3. Set the PA/monitor level safely, avoid clipping and excessive background noise, and play the logarithmic sweep.
4. Review the impulse-response plot, peak/noise ratio, octave-band T20/T30 extrapolations and fit R². Repeat at several audience positions and retain the occupancy/room state in the measurement notes.

The implementation uses inverse-filter deconvolution and noise-compensated reverse-time integration of squared impulse responses. The result remains an in-situ estimate: speaker response, microphone/codec response, non-linearity, reflections, background noise, and limited decay range can bias the values. Do not use a poor fit or low signal-to-noise result for acceptance testing.

## Transfer function, phase and Auto EQ

- A generated broadband reference is played while the selected microphone records.
- The app computes a Welch-averaged H1-style response estimate and a per-bin coherence indicator.
- The A/B comparison is a phase-shape/polarity diagnostic around a selected crossover band; each capture is independently time-aligned, so it does not retain absolute A-to-B arrival-time difference.
- PEQ candidates are cut-only, coherence-gated suggestions, with limited gain and filter count. Exported JSON is intended for manual review and DSP entry after a verification measurement.

Absolute loudspeaker delay and production-grade dual-channel transfer measurements require a simultaneous, sample-synchronous electrical reference/loopback input and measurement-microphone input on a shared clock. The current one-microphone speaker-to-microphone route includes playback, codec and device latency and cannot be treated as a calibrated Smaart-class dual-channel transfer setup. No DSP hardware is written automatically.

## CBT and room coverage design

The CBT workspace supports up to three JBL CBT entries, four listening planes and six listener points. It provides settings for broad/narrow mode, speech/music voicing, mounting height, down-angle and amplifier power. A vertical cross-section and SPL summary are provided.

The built-in prediction is an intentionally simplified estimate using average vendor sensitivity, inverse-distance free-field loss and approximate angular attenuation. It is not the JBL CBT Calculator algorithm and does not reproduce the full CBT vertical shading/delay network, frequency response, asymmetric beam shape or complex phase/lobing. For design approval, use the official JBL CBT Calculator for exact CBT model/revision and validated manufacturer data. For other loudspeaker systems, use the manufacturer's GLL/CLF data in an appropriate acoustic prediction tool.

The polar-data studio accepts a frequency/plane/angle/level table from an exact loudspeaker configuration and calculates a measured -6 dB beamwidth. Import only verified manufacturer or lab data; do not mix models, voicings or array configurations.

## What is required for professional acceptance

- Individually calibrated measurement microphone with its serial-specific correction file.
- Acoustic calibrator suitable for the microphone/coupler.
- Audio interface with stable sample rate, known gain and synchronous loopback/reference input for transfer function and absolute delay.
- Manufacturer response, polar, phase, GLL/CLF or verified complex data for the exact loudspeaker model, array and preset.
- Repeat measurements at multiple positions, with unchanged gain/processing, and compare against an independent analyser/reference system.
- Environmental and occupancy notes, noise-floor checks, clipping checks and uncertainty review.

The software must not claim IEC 61672 Class 1/Class 2 sound-level-meter conformity or ISO 3382 acceptance from a phone/browser microphone alone.
