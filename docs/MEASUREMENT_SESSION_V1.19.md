# Measurement Session — v1.18.1 foundation

## Operator workflow

1. Open the Room workspace and create a new measurement session.
2. Enter a session label and stable room code (for example `SANCTUARY`).
3. Keep that session active while capturing RT60 and Transfer Function.
4. Keep the RTA capture live in the same session when reviewing the unified report.
5. End the session before beginning a different room survey or changing the measurement campaign.

## Data model

Each capture can carry:
- immutable session ID and room ID;
- capture timestamp;
- selected input/output device IDs where the module exposes them;
- optional position, microphone profile, calibration record, weighting and time-weighting identifiers.

RT60 and Transfer results are stamped at capture start. Changing the active session during a measurement does not relabel that in-flight result.

## Compatibility gate

The Acoustic Intelligence cross-module summary only receives RTA, RT60 and Transfer data when all three are present and stamped with the same non-empty session ID. Missing legacy metadata, separate sessions or absent live RTA prevent cross-module aggregation. Individual saved results remain visible with an explicit exclusion notice.

Same session ID is necessary, not sufficient, for a defensible comparison. Operators must still verify microphone position, source level, input gain, output routing, calibration chain, weighting and environmental conditions. Device/profile/calibration fields are groundwork and are not yet all populated by every capture module.

## Known limits

- Session records are stored locally in the browser/WebView; no cloud synchronization or multi-device LAN session sharing is implemented.
- RTA is represented by the currently live spectrum, not an immutable archived spectrum snapshot.
- RT60 and Transfer results retain their own analysis limitations; a shared session ID does not make asynchronous measurements phase-coherent.
- Session metadata does not certify absolute SPL. Only a validated calibrator record tied to the exact measurement chain can support that claim.
- Position-level aggregation and 3D point linkage are future work.
