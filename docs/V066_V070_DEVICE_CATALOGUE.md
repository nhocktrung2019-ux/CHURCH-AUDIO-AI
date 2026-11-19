# v0.66–v0.70 — Provenance-aware speaker and microphone catalogue

## Scope delivered in this increment

- v0.66: typed speaker/microphone profile schema with evidence records, model identity status, units and optional technical fields.
- v0.67: response-curve and polar-data validation. Every curve must point to an evidence record; frequency points must be finite and strictly increasing. No silent sorting, interpolation or invented bins.
- v0.68: microphone intake supports exact model identity, sensitivity/unit, polar pattern, connector and phantom-power fields. Generic Shure dynamic/gooseneck entries remain intake candidates until exact models are supplied.
- v0.69: requested speaker names are captured as unverified intake candidates. Ambiguous names (including Column 600/800 and model suffixes) are not treated as verified manufacturer identities.
- v0.70: qualitative Gate/Compressor/Limiter checklists. No invented threshold, ratio, attack, release, voltage or limiter values; no DSP writes.

## Evidence rules

- Accept manufacturer datasheets or measured files with source, revision/date and measurement conditions.
- Keep relative-response dB separate from calibrated dB SPL. dBFS is not a loudspeaker response unit.
- Store original values; do not silently normalize, interpolate, smooth or extrapolate missing manufacturer data.
- A profile is engineering-usable only when identity and evidence are verified and validation has no errors.
- Manual references alone cannot verify manufacturer specifications.
- Missing fields remain absent, not zero.

## Intake list

Speaker candidates: CBT 50/70/100; Column 600/800 (brand unresolved); MA12/MA12 EX; Bose 402 IV/V, 802 V and 502; Inter-M CU7120/CU7060; TOA BS1030.

Microphone candidates: Shure dynamic microphones (exact model required) and gooseneck microphones (brand/capsule required).

The names above are user-requested intake labels, not confirmation of manufacturer model identity or specifications.

## Processing guidance safety

- Microphone Gate/Compressor suggestions are qualitative and require measured noise floor, speech-tail/bleed checks and gain-before-feedback verification.
- Speaker Compressor/Limiter guidance is advisory only. Limiter review is blocked until loudspeaker and amplifier limits and DSP detector conventions are verified.
- Every advisory sets `automaticWrite: false`; no LAN/DSP parameter is transmitted.

## Validation

Run `npm test` and `npm run build`. Hardware and datasheet validation remain separate acceptance steps. This increment does not change the existing 3D scene, room geometry, speaker placement, zone SPL records, calibration or prior measurement datasets.
