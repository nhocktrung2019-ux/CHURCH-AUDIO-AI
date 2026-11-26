# Device-specific LAN integration plan: X32 FW 4.15 + CD48 Ver. 2215

## Scope and verified target identity

This plan records the exact equipment supplied by the operator:

- Behringer X32 digital mixer, firmware 4.15.
- dbAcoustics CD48 DSP, version label Ver. 2215.

This is an engineering plan, not evidence that either device has been contacted or controlled. No network packet, discovery scan, read, or write is performed by this document.

## 1. Behringer X32 firmware 4.15

### Transport and protocol facts

The X32 family uses OSC over UDP. The console listens on UDP port 10023 and replies to the source IP/UDP port used by the client. The public unofficial X32/M32 OSC protocol reference identifies its applicability as firmware 4.0 and later; the current public revision located during planning is 4.09-02 (2025-11-30). This covers the 4.x protocol family, but the exact command set and edge cases must still be verified against the operator's X32 firmware 4.15.

Relevant protocol behavior:
- `/info` and `/status` are read-only identification/status requests.
- `/xremote` registers the client for asynchronous change notifications.
- The `/xremote` lease is approximately 10 seconds and must be renewed before expiry.
- A parameter address without arguments requests its current value; an address with a correctly typed argument sets it.
- OSC uses padded, big-endian data encoding. Do not construct packets by string concatenation.

### Implementation sequence

**X32-A: Read-only proof of identity**
1. Operator enters the X32 IP address; do not scan the subnet by default.
2. Validate IPv4 syntax and reject unspecified, loopback, multicast and broadcast destinations.
3. Send only `/info` and `/status` to UDP 10023 from an ephemeral local UDP port.
4. Require a well-formed OSC response and record model, firmware, reported state and observed source endpoint.
5. Mark the device as reachable only after a valid response, not merely after socket creation.
6. Add bounded timeout, cancellation, duplicate-response handling and rate limits.

**X32-B: Read-only parameter map**
1. Add a firmware-scoped allowlist of known parameter paths.
2. Read channel names, channel fader/mute, bus state and selected EQ/dynamics values individually or through documented safe bundles.
3. Parse OSC address, type tags and payload strictly; reject unknown tags, malformed padding, NaN/Infinity and out-of-range values.
4. Display source timestamp/age and distinguish last-known state from live state.
5. No write commands in this stage.

**X32-C: Subscription and synchronization**
1. Enable `/xremote` only after explicit operator action.
2. Renew at a conservative interval below the documented 10-second lease.
3. Bound incoming packet size and update rate; discard malformed or unexpected source packets.
4. On timeout, IP change, app suspension or network change, mark state stale and re-identify.
5. Provide a visible stop/disconnect control.

**X32-D: Guarded writes (later release gate)**
1. Add only individually reviewed parameter paths and firmware capability metadata.
2. Require a fresh read immediately before write.
3. Show target console, channel/bus, parameter, current value and proposed value.
4. Require explicit confirmation for each operation; no bulk writes during a live service.
5. Read back the exact parameter and compare against the requested value/tolerance.
6. If verification fails, report failure and provide a documented manual recovery path. Do not claim rollback unless the old value was read and the restore was itself verified.
7. Start with low-risk, reversible parameters in a muted bench test. Routing, output gain, mute, phantom power, bus sends and output processing require separate high-risk approvals.

## 2. dbAcoustics CD48 Ver. 2215

### What is and is not established

Public CD48 product information describes an RJ45 network interface, front USB and RS232 terminal control. A product listing for CD48 Premium describes 4 balanced inputs and 8 balanced outputs, matrix routing, per-input/output processing and scene storage. This product information is useful for UI planning only.

No authoritative packet-level LAN protocol, port number, framing, authentication method, device-identification request, parameter map or confirmation of protocol compatibility for the exact Ver. 2215 firmware has been verified in this review.

**Therefore: do not assume the CD48 uses X32 OSC, and do not send guessed TCP/UDP commands.**

### Safe implementation sequence

**CD48-A: Configuration profile only**
- Store exact model string `dbAcoustics CD48` and version string `2215`.
- Store operator-entered IP, subnet and gateway as configuration only.
- Validate IP/subnet consistency and duplicate controller/device addresses locally.
- Show the interface as `Configured — protocol not verified`, never as `Connected`.
- Keep all live read/write controls disabled.

**CD48-B: Obtain protocol evidence**
Require at least one of:
- Manufacturer-supplied communication protocol document for CD48 Ver. 2215.
- Manufacturer-approved SDK/API or control application integration specification.
- Written confirmation from dbAcoustics identifying transport, port, framing, authentication and firmware compatibility.
- A vendor-supported control gateway with documented commands and read-back semantics.

A PC application installer alone is not proof of protocol compatibility. If vendor support requests packet captures, collect them only with the operator's permission on the isolated test LAN and redact credentials.

**CD48-C: Read-only adapter after evidence**
- Implement the documented transport as a separate CD48 adapter.
- Begin with identity and read-only state retrieval.
- Validate response framing, checksums/lengths if applicable, version and parameter ranges.
- Add timeout, reconnect, cancellation, stale-state and malformed-frame handling.
- Test against the physical CD48 Ver. 2215, not only a simulator.

**CD48-D: Guarded writes after read-only acceptance**
- Add model/firmware-specific capability metadata.
- Require fresh state, before/after display, explicit confirmation and verified read-back.
- Save a before-state snapshot where the protocol supports it.
- Keep output gain, routing, crossover, limiter, mute and polarity changes behind high-risk confirmations.
- Never automatically apply an EQ or delay recommendation to the CD48.

## 3. Combined X32 + CD48 topology

Preferred commissioning topology:
- X32 Ethernet and CD48 RJ45 connected to the same managed LAN switch/router.
- Android phone or Windows laptop connected to the same LAN (Wi-Fi is acceptable if client isolation is disabled).
- Use static/reserved IP addresses or DHCP reservations; document subnet and gateway.
- Do not expose mixer/DSP control ports to the public internet.
- Use a dedicated VLAN or isolated audio-control LAN where practical.
- Avoid simultaneous competing control applications during protocol commissioning.

The app must maintain independent device sessions and independent protocol adapters. X32 OSC support does not imply CD48 protocol support.

## 4. Cross-platform architecture

Use a transport boundary rather than putting UDP or vendor-specific code in UI components:

- `DeviceProfile`: vendor, model, firmware, capabilities, endpoint and verification status.
- `Transport`: send/receive datagrams or documented stream frames; cancellation and timeouts.
- `ProtocolCodec`: OSC codec for X32; separate vendor-documented codec for CD48.
- `DeviceAdapter`: identify, readState, validate, apply, verify, snapshot and disconnect.
- `CommandPolicy`: read-only default, per-command risk class and confirmation requirement.
- `AuditLog`: operator, target, timestamp, command, before/after values and verification result; never store passwords or secrets.
- `UI`: live/stale/offline/protocol-unverified states and explicit confirmation.

Android browser/WebView networking limitations must be tested. If browser APIs cannot provide the required UDP transport reliably, use a Capacitor native plugin or a local LAN gateway with a narrowly scoped API. Windows browser and native packaging should share the same adapter contract but may use different transports.

## 5. Safety and security requirements

- Read-only mode is the default.
- No automatic discovery scan; operator enters or confirms the target IP.
- No control port forwarding to the internet.
- Validate every address, OSC path, type tag and parameter range.
- Reject malformed packets, oversized datagrams and non-finite numeric values.
- Rate-limit writes and subscription traffic.
- Require explicit confirmation for every hardware write.
- Verify each write by reading back from the target.
- Log outcomes and expose a clear disconnect/disable control.
- Never claim a device is online based only on a successful socket bind.
- Never claim rollback unless the previous state and restored state were both verified.

## 6. Acceptance tests

### Automated tests
- IPv4/subnet validation, duplicate IP rejection and unsafe destination rejection.
- OSC encoding/decoding: strings, int32, float32, padding, bundles, malformed packets and boundary lengths.
- X32 response parsing for `/info`, `/status`, parameter replies and subscription updates.
- Timeout, late reply, duplicate packet, malformed packet, packet loss and stale-state tests.
- Firmware capability allowlist tests.
- Command-policy tests proving no writes are possible in read-only mode.
- Audit-log redaction and confirmation-flow tests.

### Physical X32 tests (firmware 4.15)
1. Confirm console IP and firmware from the physical console.
2. Verify read-only `/info` and `/status` responses.
3. Read a small approved set of parameters and compare with the console UI.
4. Enable `/xremote`, observe a harmless fader change and verify update delivery/lease renewal.
5. Test disconnect, Wi-Fi roam, app background/resume and console reboot.
6. Only after review, test a reversible non-audio-critical write on a muted bench setup and verify read-back.

### Physical CD48 tests (Ver. 2215)
Do not begin protocol tests until vendor protocol evidence is obtained. Then verify identity/read-only state first, followed by a controlled write/read-back test with amplifier outputs muted and a saved baseline.

### Release gates
- Unit/regression tests and web build pass.
- Android debug build succeeds and is installed/tested on the target phone.
- Windows target workflow is separately built and tested.
- X32 firmware 4.15 physical tests pass.
- CD48 Ver. 2215 protocol evidence and physical tests pass before any direct-control claim.
- No production release until signed APK, update-signature continuity and field acceptance are verified.

## References reviewed

- Unofficial X32/M32 OSC Remote Protocol (covers FW 4.0+; public revision 4.09-02): https://www.academia.edu/9709659/UNOFFICIAL_X32_OSC_REMOTE_PROTOCOL
- X32 OSC protocol PDF mirror, including UDP 10023 and `/xremote` behavior: https://static.makemusic.tn/manuals/Consoles/Behringer/Behringer%20-%20X32%20OSC%20Unofficial.pdf
- CD48 Premium product/control-interface information (secondary product listing; not a packet protocol): https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/

## Current implementation status

This document is a staged engineering specification committed on a feature branch. It does not implement network transport, contact the physical devices, enable DSP writes, or create a new APK.


## Addendum: supplied CD48 vendor files reviewed (2026-11-25)

The operator has now supplied the CD48 User Manual, Ethernet Connection Guide, Central Control Protocol Table spreadsheet, PC connection video, installer and Windows Desktop Runtime installer.

The files establish additional facts:
- The User Manual specifies rear RJ45 100M Ethernet, direct-PC/LAN connection, default IP `192.168.20.20`, subnet `255.255.255.0`, gateway `192.168.20.1`, and same-subnet requirement.
- The connection video visibly shows the RJ45 100M port, the RS232 R/T/G terminal and the vendor software network setting for `192.168.20.20`.
- The spreadsheet explicitly labels its command list as **RS232 communication protocol** and states baud rate **115200**.
- Its hex columns encode ASCII text commands. The documented command families cover global mute, per-channel input/output mute, ±1 dBu input/output gain steps, Scene1–Scene8 selection, and input/output group mute and ±1% volume steps.
- The spreadsheet does not document serial data bits/parity/stop bits/flow control, response/readback semantics, or a mapping of these serial commands to Ethernet.

See `docs/CD48_VER2215_PROTOCOL_EVIDENCE.md` for decoded examples and the evidence boundary.

**Updated status:** CD48 is no longer “protocol unknown” in every respect: a vendor-supplied RS232 command table is available. It remains **Ethernet protocol unverified** and **physical RS232 compatibility pending**. Do not send the ASCII commands over TCP/UDP by assumption. Do not enable live writes until electrical serial details, framing, pacing, response/readback, and hardware revision compatibility are verified.
