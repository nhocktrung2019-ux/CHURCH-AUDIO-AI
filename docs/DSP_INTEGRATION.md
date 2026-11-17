# DSP and mixer integration

## Current integration level

The DSP workspace currently provides a manual configuration worksheet for these product families:
- Behringer X32 / M32
- Soundcraft Ui / Si / Vi (model-specific validation required)
- dbx DriveRack
- db Acoustics CD48

The worksheet exports a JSON record for project documentation and technician review. It does **not** connect to a mixer, send commands, write EQ, change gain, mute channels, alter routing, or bypass the hardware safety/confirmation workflow.

## Why direct control is not enabled yet

A reliable adapter must be specific to the exact model and firmware. Before enabling any control path, the project must have:
1. Official protocol/API documentation or a vendor-approved control interface.
2. A model/firmware capability map and explicit read/write permissions.
3. A transport implementation suitable for Android (typically a native bridge or a local network gateway where required).
4. Request timeout, reconnect, retry, authentication and device-discovery handling.
5. Read-back verification after every write, plus rollback and a local manual override.
6. Bench tests against a real device and firmware revision; a simulator or mocked response is not sufficient for release.
7. A confirmation dialog that names the target device, channel, parameter and before/after value.

## Required staged adapter contract

Each future adapter should implement discover, readState, validate, apply, verify and rollback. No device should be marked as connected merely because a network socket opens. A successful write must be confirmed by read-back from the target device.

## Safe commissioning defaults

- Begin with amplifier/DSP output low and speakers protected.
- Review crossover, polarity, delay, limiter and output routing independently.
- Do not copy PEQ or delay values between different loudspeaker models without verification.
- Preserve an exportable before-state and after-state.
- Do not run unbounded automatic EQ or gain changes during a live service.

Unknown protocol details and model-dependent ranges remain unverified until supported by current vendor documentation and a tested physical unit.
