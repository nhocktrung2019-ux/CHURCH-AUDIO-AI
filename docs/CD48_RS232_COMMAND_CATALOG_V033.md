# CD48 RS232 command catalogue — v0.33

## Scope

This module converts the documented command rows in the operator-supplied
`Digital Audio Processor Central Control Protocol Table.xls` into exact ASCII
command strings and a matching hexadecimal display.

The spreadsheet explicitly labels the interface **RS232 communication protocol**
and specifies a default baud rate of **115200**. The command table contains
ASCII text represented as hexadecimal bytes.

## Implemented command families

- Global output mute/unmute.
- Input channels 1–4: mute/unmute and gain increment/decrement by 1 dBu.
- Output channels 1–8: mute/unmute and gain increment/decrement by 1 dBu.
- Scene1–Scene8 recall.
- Input groups 1–4: mute/unmute and volume increment/decrement by 1%.
- Output groups 1–4: mute/unmute and volume increment/decrement by 1%.

The public TypeScript API accepts human-facing one-based channel/group/scene
numbers and maps them to the zero-based indices shown in the vendor command paths.

## Safety contract

Every generated object is tagged:
- Device: dbAcoustics CD48, firmware label Ver. 2215.
- Transport: RS232 only.
- Baud rate: 115200 (the only serial setting explicitly stated in the supplied table).
- Risk: high-impact.
- Explicit confirmation required.
- Readback unsupported by the supplied table.

No serial port is opened and no command is transmitted. This is a command
catalogue, not a hardware adapter.

## Deliberately not inferred

The supplied table does not specify data bits, parity, stop bits, flow control,
electrical pinout/voltage levels, terminator requirements, minimum message
interval, response framing, acknowledgements or readback requests. These remain
commissioning requirements.

The Ethernet connection guide confirms an RJ45 network interface but does not
establish the Ethernet control protocol. The RS232 ASCII command strings must
not be sent over TCP/UDP without a vendor specification confirming that mapping.

## Tests

`tests/cd48Rs232.test.mjs` checks exact command strings, hex conversion,
one-based-to-zero-based mapping, documented range limits and command-object
validation. Run with the repository's existing `npm test` script.
