# X32 OSC codec foundation — read-only stage

This increment adds a dependency-free OSC message codec and a narrow read-only query builder for the operator-confirmed X32 firmware 4.15 target.

## Included
- OSC padded UTF-8 strings, int32, float32 and blob encoding/decoding (big-endian).
- Strict malformed-packet, padding, unsupported-tag and non-finite-number rejection.
- IPv4 destination validation that rejects unspecified, loopback, multicast and limited-broadcast addresses.
- Read-only query allowlist for `/info`, `/status`, selected channel fader/on reads, bus fader reads and stereo-main fader read.
- Node regression tests using the repository's existing `node:test` convention.

## Deliberate limits
- No UDP socket, network scan, device discovery or packet transmission is implemented.
- No X32 write/set API is exposed.
- No CD48 protocol is inferred or implemented.
- This codec does not prove compatibility with a physical X32 running firmware 4.15. The next step is a Capacitor Android native UDP transport and physical read-only commissioning.
- OSC bundles and type tags outside `s/i/f/b` are rejected until explicitly required and tested.

Protocol reference: unofficial X32/M32 OSC remote protocol (FW 4.0+ family), which documents UDP 10023 and `/info` / `/status` query behavior. Exact firmware 4.15 hardware verification remains required.
