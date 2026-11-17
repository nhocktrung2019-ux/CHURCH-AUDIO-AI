# DSP integration matrix — v0.23

This matrix separates manufacturer-documented connection methods from protocol assumptions. The application currently provides reference notes and manual configuration worksheets only. It does not connect to, read from, or write parameters to any DSP or mixer.

| Profile | Model scope | Documented connection/control surface | Integration state |
|---|---|---|---|
| Behringer X32 / Midas M32 | X32 and M32 families; verify exact model/firmware | OSC-compatible UDP protocol described by a community protocol reference; commonly documented on UDP 10023 | Community reference only; no network adapter |
| Soundcraft Ui | Ui12, Ui16, Ui24R | Built-in Wi-Fi/Ethernet and HTML5 browser control surface | Manufacturer-documented surface; no generic API adapter |
| Soundcraft Si / Vi | Si Compact, Si Expression, Si Performer, Vi Series, Vi3000 | HiQnet network and ViSi Remote ecosystem | Manufacturer-documented ecosystem; not interchangeable with Ui browser control |
| dbx DriveRack PA2 | PA2 | Dedicated dbx PA2 Control App and owner documentation | Vendor app reference; no public third-party protocol verified |
| dbx DriveRack VENU360 | VENU360 | Ethernet connection and dedicated VENU360 Control App | Manufacturer-documented transport; proprietary command channel not implemented |
| dbx DriveRack 4800 / 4820 | 4800, 4820 | Ethernet HiQnet networking control | Manufacturer-documented transport; HiQnet adapter not implemented |
| db Acoustics CD48 | Pictured CD48 revision (LCD Ver 2215) | Supplied rear image shows RJ45 labelled 100M Ethernet; front LCD shows 192.168.20.20; front USB COM2 and rear RTG terminal are visible | User-image evidence for the physical port; network protocol not verified |

## Source references

- Behringer X32 / Midas M32 OSC compatibility and UDP port reference: https://static.makemusic.tn/manuals/Consoles/Behringer/Behringer%20-%20X32%20OSC%20Unofficial.pdf
  - This is a community protocol document, not a manufacturer-issued integration contract. Use it only as a research starting point.
- Soundcraft Ui Series browser control: https://www.soundcraft.com/en-US/get-started/ui-series
- Soundcraft ViSi Remote for Si/Vi consoles and HiQnet: https://www.soundcraft.com/en-US/products/visi-remote.html
- Soundcraft Si/Vi network setup and dedicated HiQnet environment: https://help.harmanpro.com/si-and-vi-mixers-hiqnet-connectivity-and-wireless-router-configuring
- dbx DriveRack PA2 and vendor control app: https://dbxpro.com/en-US/products/driverack-pa2
- dbx DriveRack VENU360 owner manual: https://dbxpro.com/en/product_documents/dbx_driverack_venu360_manual-pdf
- dbx DriveRack 4820 HiQnet features (4800/4820 family must still be verified individually): https://dbxpro.com/en-US/products/driverack-4820/features
- db Acoustics CD48 product page: https://dbacoustic.vn/crossover-dbacoustic-cd48

## Integration rules before any direct control is enabled

1. Require exact manufacturer, model, hardware revision, firmware version and transport.
2. Keep discovery and read-only status separate from parameter writes.
3. Verify parameter paths, units, enumerations, min/max/step values, channel indexing and scene semantics on the exact device.
4. Require explicit user confirmation before changes to gain, mute, phantom power, crossover, limiter, output routing or scene recall.
5. Record a snapshot before writes; implement read-back verification, bounded retries, timeout handling and rollback.
6. Test with amplifiers/speakers muted or disconnected, then test at low level in a controlled environment.
7. Do not merge model variants into a generic adapter unless the vendor documents identical protocol behavior.

A model appearing in this matrix means only that a model-specific reference profile exists. It does not mean live compatibility, remote control, parameter read/write, or certification.

## db Acoustics CD48 — Ethernet / Wi-Fi LAN distinction

The app evidence grade is intentionally user-supplied-image, not manufacturer network-protocol documentation. The user-supplied front/rear reference images show a db Acoustics CD48:
- Rear RJ45 jack is explicitly labelled "100M Ethernet".
- Front LCD visibly displays "IP: 192.168.20.20" and "Ver:2215".
- Front control port is labelled "COM2"; rear panel also shows a three-position terminal marked RTG.
- The image therefore confirms that the pictured CD48 hardware profile has an Ethernet port. This is stronger evidence for this pictured configuration than the generic wording on the product page, which does not enumerate every physical port: https://dbacoustic.vn/crossover-dbacoustic-cd48
- A third-party CD48 Premium listing independently describes RJ45/LAN, USB COM2 and RS232: https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/

The app pre-fills 192.168.20.20 as the IP shown in the image, but the operator must compare it with the actual device LCD because it may have been changed. The /24 subnet is only an initial worksheet default and must be checked against the router/device configuration. For Wi-Fi LAN, the DSP is wired by Ethernet to a router/switch and the Android device joins that router's Wi-Fi; the images do not show a Wi-Fi radio in the DSP.

A displayed IP and an RJ45 link do not establish the application protocol, service port, authentication, or command acknowledgement. No CD48-specific network service port, TCP/UDP protocol, command schema or session flow has been verified here. The app must not scan the subnet or send guessed commands. A direct adapter requires the exact vendor software/protocol documentation or a vendor-supported interface, followed by read-only testing and safety-reviewed write tests. PH48D and CD4008RTS settings must not be borrowed for CD48.


## CD48 Premium — offline 4 IN / 8 OUT scene editor

The app now includes a local draft editor for the pictured CD48 family:
- Four input channels and eight output channels.
- An explicit 4 × 8 routing matrix. All routes default OFF so a newly created draft cannot silently create an audio path.
- Per-channel gain, delay, polarity, mute and eleven PEQ slots.
- Scene draft slot 1–128 and JSON export. Drafts persist locally in the Android/WebView app storage.
- Structural validation checks the 4×8 topology, IPv4 octets, scene slot, 11 PEQ slots, finite PEQ values, positive Q and delay 0–2000 ms.
- The JSON schema permanently declares `hardwareWriteEnabled: false`; this editor is not a live controller and does not transmit settings.

Seller documentation for CD48 Premium describes 4 inputs, 8 outputs, 11-band EQ per input/output, delay up to 2000 ms, crossover filter families, matrix, gate/compressor/limiter, USB/LAN/RS232 and 128 scenes: https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/ . The official DBacoustic CD48 page links a guide labelled CD48RTS: https://dbacoustic.vn/crossover-dbacoustic-cd48 . The guide file could not be inspected in this development pass, and no CD48-specific LAN command framing, service port, authentication, read-response format or write acknowledgement has been verified.

The editor deliberately excludes live gate/compressor/limiter/crossover writes until the exact device revision, firmware, command schema and parameter ranges are confirmed. Do not assume that the CD48RTS guide is protocol-compatible with the pictured Ver 2215 device until the vendor confirms it. No network scan, guessed TCP/UDP port, packet send, or DSP write is performed.
