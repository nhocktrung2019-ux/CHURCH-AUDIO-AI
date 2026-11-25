# CD48 Ver. 2215 — protocol evidence from supplied vendor files

## Evidence reviewed

The operator supplied:
- `Digital Audio Processor Central Control Protocol Table.xls`
- `Digital Audio Processor User Manual-DBAcoustic.pdf`
- `Digital Audio Processor Connection User Guide --2025.05.26--.pdf`
- `How to connect the device with computer -CD48.mp4`
- `DBA.DB Acoustic Processor_2025-12-14.inst.exe`
- `windowsdesktop-runtime-6.0.33-win-x64.exe`

This document records only what can be established from those files. The installer and runtime were not executed.

## 1. Confirmed connection facts

From the supplied User Manual:
- Ethernet interface: rear-panel RJ45, described as 100M Ethernet.
- Direct computer-to-processor Ethernet connection and LAN connection are both described.
- Default device IPv4: `192.168.20.20`.
- Default subnet mask: `255.255.255.0`.
- Default gateway: `192.168.20.1`.
- The PC and processor must be in the same network segment.
- The manual describes the software workflow as search/add device, modify device details, then Login.
- RS232 is described as an interface for a third-party central-control system.
- USB COM2 is described for computer control on supported models.

The supplied Connection Guide repeats the same default device IP and shows the software's Online device → Add → device list → Login sequence. The supplied video shows the rear-panel RJ45 labeled 100M Ethernet, the RS232 terminal labeled R/T/G, and the software network setting with device IP 192.168.20.20.

**Not documented in these connection materials:** Ethernet transport (TCP or UDP), control port, framing, handshake, authentication/session sequence, request/response format, or a mapping from the RS232 commands below to Ethernet messages.

## 2. Central-control table: RS232 facts

The supplied spreadsheet labels its section **“RS232 communication protocol”** and states:

- Default RS-232 baud rate: **115200**.

The spreadsheet does not specify data bits, parity, stop bits, flow control, electrical pinout/voltage levels, message pacing, or response/acknowledgement behavior. Do not fill these gaps with assumed serial defaults.

The spreadsheet's “Hexadecimal code” cells are ASCII character bytes written in hexadecimal notation. For example, bytes:

`73 65 74 6E 72 20 30 ...`

decode to readable ASCII beginning `setnr 0 ...`. This is a text command representation, not evidence of a binary packet protocol.

## 3. Command families explicitly present in the table

The table includes these command groups:
- Global output mute/unmute.
- Input channel 1–4 mute/unmute.
- Input channel gain increment/decrement by 1 dBu.
- Output channel 1–8 mute/unmute.
- Output channel gain increment/decrement by 1 dBu.
- Scene selection (Scene1–Scene8).
- Input group 1–4 mute/unmute and volume increment/decrement by 1%.
- Output group 1–4 mute/unmute and volume increment/decrement by 1%.

Examples decoded from the spreadsheet:

| Operation | ASCII command |
|---|---|
| Global unmute | `setnr 0 d0/data/d0/pros/gnOut0/arg/allMute false 0;` |
| Global mute | `setnr 0 d0/data/d0/pros/gnOut0/arg/allMute true 0;` |
| Input 1 unmute | `setnr 0 d0/data/d0/pros/gnIn0/arg/chns/0/mute false 0;` |
| Input 1 mute | `setnr 0 d0/data/d0/pros/gnIn0/arg/chns/0/mute true 0;` |
| Input 1 gain +1 dBu | `setnr 0 d0/data/d0/pros/gnIn0/arg/chns/0/incGain 1.00 0;` |
| Output 1 mute | `setnr 0 d0/data/d0/pros/gnOut0/arg/chns/0/mute true 0;` |
| Output 1 gain -1 dBu | `setnr 0 d0/data/d0/pros/gnOut0/arg/chns/0/incGain -1.00 0;` |
| Select Scene 1 | `setnr 0 m/dev/arg/autoFiles/scene/curId 0 0;` |

Channel indices in the table are zero-based in the command paths: input channel 1 is `chns/0`, output channel 1 is `chns/0`. Scene1 maps to preset index 0 in the listed examples.

The table provides **set commands only** for the listed controls. It does not provide matching GET/readback commands or acknowledgements. Therefore the examples are not sufficient to implement a safe verified write workflow.

## 4. What can now be implemented safely in CHURCH AUDIO AI

- Add a CD48 RS232 protocol profile marked **vendor-table documented / physical validation pending**.
- Build a parser/catalogue for the documented ASCII command templates, with strict channel/group/scene bounds.
- Add unit tests proving the exact documented command strings and ASCII-hex conversion.
- Keep command generation separate from transport.
- Keep the hardware transport disabled until serial electrical interface, framing/terminator, pacing, response behavior and physical device revision are confirmed.
- Keep all commands behind an explicit operator action. Global mute, channel mute, gain changes and scene recall are high-impact operations and must not be sent automatically.
- Do not claim that this RS232 command table is the Ethernet LAN protocol.

## 5. Ethernet implementation gate

The manual and video establish that Ethernet is available for the vendor PC software, but they do not disclose the packet protocol. Before implementing a native TCP/UDP adapter, obtain one of:
- A vendor-issued Ethernet/control protocol specification for CD48 Ver. 2215.
- A vendor-approved SDK/API with documented port, framing, authentication and readback.
- Written manufacturer confirmation of whether Ethernet uses the same command language and how it is transported.

If the vendor asks for packet capture, collect it only with the operator's permission on an isolated test LAN, with credentials removed before sharing.

## 6. Device capability context from User Manual

For the CD48/CS48/VC48 family, the supplied manual describes:
- 4 input / 8 output.
- 48 kHz sampling; 32-bit DSP processing, 32-bit ADC and 24-bit DAC.
- 11-band EQ per input/output channel.
- Input noise gate and compressor; output limiter.
- HPF/LPF, phase, matrix routing and up to 2000 ms delay per input/output channel.
- Built-in signal generator: pink noise, white noise, sweep and adjustable 20 Hz–20 kHz sine.
- 32 preset scenes for the CD48 family section of the manual.
- The manual's default credentials are printed in the document; CHURCH AUDIO AI must not prefill or store these credentials. The operator should change defaults on the device where supported.

These are product capabilities from the manual, not proof that each capability can be controlled through the external central-control command table.

## 7. Validation status

- Spreadsheet decoded and command examples cross-checked against the stored hex byte sequences.
- User Manual and Connection Guide inspected.
- Connection video sampled; RJ45, R/T/G RS232 terminal and network setting are visible.
- Installer and .NET Desktop Runtime were not executed or reverse-engineered.
- No serial bytes or network packets have been sent to the physical DSP.
- No live connection, readback, hardware compatibility, or APK build is claimed.
