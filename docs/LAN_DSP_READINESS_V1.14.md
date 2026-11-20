# CHURCH AUDIO AI v1.14 — LAN/DSP readiness gate

## Scope

This stage hardens the existing CD48 LAN preflight before any model-specific network adapter is attempted. It validates manually entered IPv4 host addresses and subnet configuration only.

## Added checks

- Strict dotted-quad IPv4 parsing.
- Subnet prefix range validation (/1 through /30).
- Device and controller must use different IP addresses.
- Reject unspecified, loopback, link-local and multicast addresses as endpoint hosts.
- Reject subnet network and broadcast addresses as endpoint hosts.
- Preserve same-subnet assessment for wired Ethernet and Wi-Fi-to-LAN paths.
- Keep the result explicitly labelled protocol-unverified.

## Explicit non-features

The app does not ping, scan ports, discover devices, authenticate, open a socket, query parameters, or send commands. A valid IP/subnet pair is not evidence that a DSP is online or controllable.

## Acceptance gates before a live adapter

1. Obtain vendor-approved protocol documentation for the exact model and firmware.
2. Identify transport, port, authentication/session requirements and parameter schema.
3. Implement read-only identity and state queries first.
4. Validate response framing, timeouts, disconnect/reconnect and malformed responses.
5. Test on a separate physical DSP with outputs muted/attenuated and capture read-back evidence.
6. Add write controls only after explicit operator confirmation, before/after snapshots, read-back verification and rollback are tested.

## Safety

All current mixer/DSP workflows remain manual-only. No EQ, gain, delay, crossover, limiter, routing or mute values are transmitted to hardware. The 3D room model and measured SPL points are not modified by this stage.
