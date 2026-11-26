# CD48 Command Review Panel v0.34

## Scope

The DSP & Mixer workspace now exposes a CD48-only command review panel when the selected device profile is dbAcoustics CD48. It builds preview commands from the RS232 catalogue and displays both the ASCII command and the vendor-table-style uppercase HEX representation.

Supported previews:
- Global output mute/unmute.
- Input channels 1–4: mute/unmute and ±1 dB gain step.
- Output channels 1–8: mute/unmute and ±1 dB gain step.
- Scene 1–8 recall.
- Input/output groups 1–4: mute/unmute and ±1% volume step.

## Operator review guard

The operator must check the acknowledgement and type `REVIEW CD48 COMMAND` before the panel reports that the preview has been reviewed. This is a UI review acknowledgement only; it is not a device authorization token and does not enable execution.

## Explicitly not implemented

- No serial-port enumeration or RS232 transmission.
- No TCP/UDP socket, Ethernet discovery, ping or guessed service port.
- No CD48 readback, acknowledgement parser or state synchronization.
- No automatic application of settings and no background control.
- No claim that framing, parity, stop bits, flow control, cable pinout/electrical levels or minimum command interval are known.

The supplied spreadsheet documents RS232 command strings and a baud rate of 115200. The remaining serial link parameters must be obtained from authoritative vendor documentation and validated on a controlled bench setup before a transport adapter is implemented.

## Safety note

Global mute and scene recall can interrupt or materially change the sound system. Preview the command, verify the physical device and channel mapping, and schedule any future hardware commissioning outside live services. The current panel has no Send or Apply action.
