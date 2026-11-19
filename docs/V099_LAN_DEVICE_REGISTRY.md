# v0.99 — LAN device registry and readiness

This milestone adds a local, persistent registry for multiple mixer/DSP devices. It records exact identity (manufacturer, model, hardware revision, firmware), transport, device/controller IPv4 addresses, subnet prefix, protocol evidence/reference and technician-verified physical/network checklist items.

## Safety boundary
- No ICMP ping, subnet discovery, port scanning, TCP/UDP connection, authentication, protocol packet, parameter read, or hardware write is implemented.
- Same-subnet assessment is a calculation on manually entered IPv4 values only. It does not mean a device is online or reachable.
- Vendor workflow readiness requires exact hardware/firmware identity, valid same-subnet addressing, technician-confirmed physical/network checks and a vendor-confirmed protocol reference. It is only a gate for a future read-only adapter test, not a connection state.
- CD48 LAN protocol/port remains unverified for the pictured Ver 2215 device; do not infer a port or borrow another model's commands.
- All changes to Gain, EQ, Delay, Mute, Phantom, Limiter, routing and scenes remain disabled.

## Next requirements
Obtain the exact mixer/DSP make, model, hardware revision, firmware and official protocol/API documentation. Then implement a model-specific read-only identity/status adapter with bounded timeouts and explicit user consent. Add writes only after vendor-supported command schema, parameter bounds, read-back verification, rollback and controlled low-level bench testing are complete.
