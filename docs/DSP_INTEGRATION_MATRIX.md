# DSP integration matrix — v0.23

This matrix separates manufacturer-documented product/control ecosystems from protocol assumptions. Church Audio AI currently provides a selectable model catalogue and manual configuration worksheets only. It does not connect to, read from, or write parameters to any DSP or mixer.

| Profile | Model scope represented in the app | Documented control surface / transport | Integration state |
|---|---|---|---|
| Behringer X32 / Midas M32 | X32, Compact, Producer, Rack, Core; M32 Live, M32R Live, M32C | Ethernet; community OSC-compatible UDP reference | Manual worksheet; no network adapter |
| Behringer WING | WING, WING-BK | Model-specific Ethernet/control ecosystem | Separate profile; X32 mapping is not assumed compatible |
| Behringer X AIR / Midas MR | XR12, XR16, XR18, X18, MR12, MR18 | Built-in Wi-Fi/Ethernet/USB varies by model; vendor apps | Manual worksheet; no shared protocol asserted |
| Midas HD96 | HD96-24-CC-IP, HD96-AIR-CC-TP | HD96-specific control ecosystem | Separate from M32; no live adapter |
| Yamaha digital consoles | DM7/DM7 Compact, DM3/DM3 Standard, CL1/3/5, QL1/5, TF1/3/5, TF-RACK, RIVAGE PM engines/control surfaces | ProVisionaire/vendor software; Dante or TWINLANe varies by model | Manufacturer ecosystem reference; no direct app adapter |
| Yamaha installation DSP | DME7/5/3, MRX7-D, MTX5-D, MTX3 | Ethernet; ProVisionaire Control PLUS / Kiosk support varies by model | Manual worksheet; no generic parameter API |
| Soundcraft Ui | Ui12, Ui16, Ui24R | Built-in Wi-Fi/Ethernet; HTML5 browser control | Vendor browser workflow; no generic API adapter |
| Soundcraft Si | Si Expression 1/2/3, Si Impact, Si Performer 1/2/3 | Model/software-specific remote-control ecosystem | Separate from Ui/Vi; no generic OSC adapter |
| Soundcraft Vi | Vi1000/2000/3000/5000/7000, Vi4, Vi6 | ViSi Remote / HiQnet ecosystem, model/version dependent | Vendor ecosystem reference; no direct app adapter |
| dbx DriveRack PA2 | PA2 | Wi-Fi; dedicated PA2 Control App | No public third-party packet API verified |
| dbx DriveRack VENU360 | VENU360, VENU360-B, VENU360-D | Ethernet; dedicated VENU360 Control App | Vendor transport documented; command adapter not implemented |
| dbx DriveRack 260 | 260 | USB / RS-232; model-specific vendor utility | Separate from PA2/VENU360 |
| dbx DriveRack 4800 / 4820 | 4800, 4820 | Ethernet; HiQnet networking control | HiQnet adapter not implemented |
| dbx legacy DriveRack | 220i, PA, PA+, PX, Studio, goRack | Transport/software varies by exact model and revision | Project records only; verify each unit |
| db Acoustics CD48 | CD48, CD48RTS, CD48 Premium worksheet variants | RJ45/USB COM2/serial options vary by revision; Android OTG path unverified | Local 4×8 draft editor only; no live adapter |

The catalogue is designed to let a technician select a named model rather than imply that every product in one brand shares a protocol. It is a curated set for the requested manufacturers and common model families, not a claim of compatibility with every mixer or DSP on the market. A model appearing here means only that a manual reference profile exists.

## Source references

- Behringer product catalogue for X32/WING model listings: https://www.behringer.com/en/products?collection_id=x32-series
- Midas official M32-series catalogue: https://www.midasconsoles.com/en/products?collection_id=m32-series
- Yamaha ProVisionaire Control PLUS support matrix (DM/CL/QL/TF/RIVAGE PM and DME/MRX/MTX model families): https://vn.yamaha.com/vi/business/audio/products/provisionaire/provisionaire/provisionaire-control-plus/
- Soundcraft official downloads and model catalogue (Ui, Si and Vi series): https://www.soundcraft.com/en-US/support_downloads/download_types/english-cutsheet
- dbx official DriveRack product family (PA2, VENU360 and 260): https://dbxpro.com/en-US/product_families/driverack
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


## CD48 USB Serial connection — INTEK procedure (documented)

Reference: INTEK's guide "Hướng dẫn kết nối Phần mềm Crossover CD48 / CD48RTS – CD48 / CD48RTS PREMIUM qua USB", published 10 March 2026:
https://intekvietnam.com/huong-dan-ket-noi-phan-mem-crossover-cd48-cd48rts-cd48-cd48rts-premium-qua-usb/

The guide documents the Windows desktop workflow:
1. Install the matching CD48 control software and USB driver where required.
2. Connect the processor over USB and inspect Windows Device Manager → Ports (COM & LPT) to identify its USB Serial Port (example COM3).
3. In CD48 Control Software, add a device; select **Serial port (login)** and **Use processor USB serial port**.
4. Confirm, then press **Login**. A successful connection shows Online and synchronizes the processor parameters.
5. Verify response using a controlled EQ, Delay or Mute change.
6. For "Must login first", select the login-enabled serial interface. For a missing COM port, check driver, cable and USB port.

This is evidence for a USB-serial + login session workflow in the vendor desktop application. It does NOT publish the serial baud rate, framing, command bytes, authentication exchange, parameter serialization, or a supported Android USB API. The example COM3 is a Windows enumeration example, not a fixed port number.

### Church Audio AI implementation plan

- Add a dedicated CD48 USB transport, separate from Ethernet/Wi-Fi LAN.
- On Android, implement a native USB Host/OTG bridge with runtime permission request, USB device/interface/endpoint enumeration and explicit detach/reconnect handling. Do not assume browser Web Serial is available in Android WebView.
- Implement a CD48 protocol adapter only after obtaining vendor-approved protocol documentation or a lawful protocol specification from the matching CD48 software/driver package.
- Preserve the login state machine: disconnected → USB device detected → permission granted → serial interface opened → login required → authenticated/online → parameter sync.
- Treat "Online" as authenticated session state, not merely successful USB open.
- First milestone is read-only identity/status and a captured parameter snapshot; parameter writes remain disabled until read-back, error handling and rollback are verified.

No serial baud rate, parity, data bits, stop bits, flow control, packet format or login payload is inferred from the COM-port tutorial. No serial bytes are sent by the current app. USB and LAN are distinct transports and must not share an unverified protocol implementation.

## CD48 software version matching

INTEK's software index lists separate packages for CD48 v2, CD48RTS v2, legacy CD48/CD48RTS, V3 2025 CD48/CD48RTS and V4 PREMIUM CD48/CD48RTS:
https://intekvietnam.com/tong-hop-phan-mem-vang-so-dbacoustic-intek/

Do not select a package based on the generic "CD48" name alone. Match the exact hardware label, front-panel firmware display, and vendor confirmation. The pictured device's LCD shows Ver 2215; this display alone does not prove which Windows package or wire protocol applies.
