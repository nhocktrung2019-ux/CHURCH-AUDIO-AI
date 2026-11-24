# Acoustic Intelligence Diagnostics — implementation note

## What is implemented in this branch

- `src/audio/acousticDiagnostics.ts` provides a pure cross-module diagnostics function.
- It groups measured RTA bins into five broad frequency regions and calculates energy averages.
- It excludes simulated/manual spectrum points and invalid/out-of-range values.
- It evaluates supplied octave-band RT60 only when RT60 and fit quality are valid.
- It summarizes transfer coherence and reports low-coherence risk.
- It checks PCM sample rate, RMS/peak, clipping and invalid-sample percentages when capture metadata is supplied.
- It explicitly separates relative spectrum shape from calibrated absolute dB SPL.
- `src/audio/AcousticDiagnosticsPanel.tsx` is integrated into the Room workspace and currently consumes the live RTA spectrum.

## Interpretation limits

- The live panel currently receives RTA spectrum only. RT60 and Transfer Function fields remain unavailable in this live report until their measurement sessions are explicitly passed into the same report model.
- RTA levels are relative dBFS, even when microphone frequency correction is applied. A frequency correction curve does not establish absolute SPL sensitivity.
- Broad-band imbalance flags are investigation prompts, not automatic room diagnoses. They do not prove a room mode, speaker defect, absorption issue or required EQ move.
- A low high-frequency result can come from loudspeaker directivity, distance, obstruction, microphone response, correction file, or room absorption.
- A valid RT60 estimate still requires adequate dynamic range, fit quality, low noise and repeat measurements at representative positions.
- Coherence is meaningful only for a valid reference/measurement chain. It is not inferred from independent microphones or composite spectra.
- No automatic EQ, mixer/DSP writes, certification, or standards-compliance claim is added.

## Suggested field workflow

1. Confirm the correct microphone/input and stable gain; disable OS noise suppression/AGC where possible.
2. Load the correction file for the exact measurement microphone. Do not treat it as SPL calibration.
3. Establish absolute level only with an acoustic calibrator and a saved calibration record for that exact input chain.
4. Capture RTA at a fixed point, then repeat at audience positions with consistent source level and weighting.
5. Run the RT60 sweep separately with safe output level and inspect each octave-band fit and peak-to-noise ratio.
6. Run transfer measurement only with a verified reference/loopback and supported synchronous channel path.
7. Compare measured results with manufacturer response/polar data for the exact loudspeaker revision.
8. Apply only conservative, operator-reviewed cuts; remeasure after each meaningful system change.

## Validation status

The pure diagnostics tests are committed in `tests/acoustic-diagnostics.test.mjs`. GitHub Actions and the TypeScript/Vite build must pass on the pull request before merge. Real Android/USB interface, calibrated microphone, reference analyser and room acceptance tests remain required.
