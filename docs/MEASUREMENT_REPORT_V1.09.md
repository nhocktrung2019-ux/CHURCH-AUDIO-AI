# v1.09 — Professional Measurement Report

## Report workflow

1. Open the **Báo cáo đo lường / REPORTS** workspace.
2. Enter the project name, church/site, operator and field notes.
3. Press **Làm mới dữ liệu báo cáo** to read the current device-local records.
4. Review each source and its evidence label before exporting.
5. Export JSON for structured archiving, CSV for spreadsheet analysis, or use **In / Lưu PDF** and choose “Save as PDF” in the platform print dialog.

## Schema

- Format: `CHURCH_AUDIO_MEASUREMENT_REPORT`
- Schema version: `1.0.0`
- JSON is the structured project report.
- CSV is a UTF-8/BOM-prefixed tabular extract with stable columns.
- PDF is produced by the browser/Android print-to-PDF pipeline; it is not digitally signed.

## Evidence classes and exclusions

| Source | Report treatment |
| --- | --- |
| Manual SPL zone worksheet | `manual-unverified`; retained as entered, excluded from calibrated SPL summaries |
| Transfer Function response | Relative magnitude/phase/coherence; not absolute dB SPL |
| RT60 sweep result | In-situ estimate with band fit and noise metadata |
| One-point SPL offset | Context only; not proof that each zone reading used the offset |
| Microphone correction file | Profile identity and point count recorded; current RT60 sweep does not apply this curve |
| 3D/model/theoretical values | Not emitted as measured observations |

The report never converts dBFS to dB SPL, never fabricates missing measurements, and never treats a model output as a microphone reading.

## RT60 provenance

The latest successful sweep stores capture time, technician-supplied zone and microphone position, selected-input category, sweep duration, tail duration, sample rate, quality, peak-to-noise, octave-band RT20/RT30/RT60 and fit R². Raw microphone PCM/impulse samples are not included in this report.

## Field acceptance

- Verify microphone/input chain and calibrator reference on the actual measurement setup.
- Repeat measurements at multiple representative seats.
- Review RT decay plots, fit range, R², peak-to-noise and room noise.
- Check the generated PDF/CSV on the target Android device and desktop browser.
- This output is a technical survey report, not an IEC 61672 or ISO 3382 compliance certificate.
