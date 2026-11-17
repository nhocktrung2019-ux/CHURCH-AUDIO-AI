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
| db Acoustics CD48 | CD48; confirm standard/Premium/regional hardware revision | Manufacturer product page lists front USB control and rear RS232 control | Physical ports documented; serial/USB packet protocol not verified |

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

The model name alone is not enough to enable LAN:

- The DBacoustic CD48 product page lists front USB control and rear RS232 control; it does not list an Ethernet port or Wi-Fi radio: https://dbacoustic.vn/crossover-dbacoustic-cd48
- A third-party CD48 Premium product listing reports USB, RJ45/LAN and RS232: https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/
- A PH48D page reports 100M Ethernet and a default IP, but PH48D is a different model; none of its IP defaults, service ports or protocol behavior may be copied to CD48: https://dbacoustic.vn/crossover-dbacoustic-ph48d

The app therefore requires the operator to confirm the physical RJ45 jack on the exact CD48 revision before marking an Ethernet/Wi-Fi-LAN path as eligible. For Wi-Fi LAN, the processor is wired by Ethernet to a router/switch and the Android device joins that router's Wi-Fi; this does not imply built-in Wi-Fi on the DSP. A same-subnet check is only an addressing pre-check, not proof of reachability, device discovery, authentication or remote control.

No CD48 network service port, TCP/UDP protocol, command schema, authentication handshake or acknowledgement behavior has been verified. The app must not scan the subnet or send guessed commands. A direct adapter requires the vendor's exact model/revision protocol specification or a vendor-supported interface, followed by read-only testing and safety-reviewed write tests.
