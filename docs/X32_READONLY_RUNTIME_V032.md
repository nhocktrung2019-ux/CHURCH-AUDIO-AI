# X32 read-only runtime contract (v0.32)

## Runtime boundary
`X32ReadOnlyClient` is a transport-independent request coordinator. A native platform adapter must implement `X32DatagramTransport.exchange` and return the UDP source address, source port and response bytes.

## Safety controls
- Fixed destination port: UDP 10023.
- Explicit IPv4 host only; no broadcast, multicast, loopback or hostname discovery.
- Timeout bounds: 100–5000 ms (default 1200 ms).
- One in-flight request per client instance.
- Response source IP and source port must match the configured X32.
- OSC response address must match the request.
- Requests pass through the existing read-only OSC allowlist.
- No setter, scene, routing, mute, gain-write or DSP-configuration API exists.

## Platform integration status
- Android: requires a Capacitor native UDP adapter; the webview cannot open arbitrary UDP sockets itself.
- Windows: requires a separate native UDP transport or a trusted LAN gateway. This abstraction is shared, but does not itself implement either platform transport.
- The community `capacitor-udp-socket` plugin is a candidate for Android/iOS only; evaluate its maintenance, Capacitor 7 compatibility, permissions and lifecycle before adopting it. It is not a Windows solution.
- No hardware packets are sent by this code and no physical X32 FW 4.15 validation is claimed.

## Tests
Node tests use an injected fake datagram transport to verify target, timeout, source validation, OSC address matching, single-flight behavior and read-only path enforcement.
