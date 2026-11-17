export type DspEvidenceGrade =
  | "manufacturer-documentation"
  | "community-protocol-reference"
  | "user-supplied-image";

export type DspProfile = {
  id: string;
  name: string;
  family: string;
  models: string[];
  controlStatus: "manual-only";
  transport: string;
  evidenceGrade: DspEvidenceGrade;
  documentationUrl: string;
  integrationNote: string;
  validationNeeded: string;
};

export const dspProfiles: DspProfile[] = [
  {
    id: "behringer-x32-midas-m32",
    name: "Behringer X32 / Midas M32",
    family: "Digital mixing console",
    models: ["X32 family", "M32 family"],
    controlStatus: "manual-only",
    transport: "Ethernet · OSC-compatible UDP reference (commonly documented at port 10023)",
    evidenceGrade: "community-protocol-reference",
    documentationUrl: "https://static.makemusic.tn/manuals/Consoles/Behringer/Behringer%20-%20X32%20OSC%20Unofficial.pdf",
    integrationNote: "The available protocol reference describes OSC-compatible control for X32/M32. This app does not send OSC packets yet; port, subscriptions and parameter paths must be checked against the exact firmware and model.",
    validationNeeded: "Obtain the exact console firmware/protocol revision, verify read-only query and response handling on a separate test console, then validate write acknowledgement, reconnect, rate limiting and rollback before enabling control.",
  },
  {
    id: "soundcraft-ui",
    name: "Soundcraft Ui Series",
    family: "Digital mixing console",
    models: ["Ui12", "Ui16", "Ui24R"],
    controlStatus: "manual-only",
    transport: "Built-in Wi-Fi / Ethernet · HTML5 browser control interface",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://www.soundcraft.com/en-US/get-started/ui-series",
    integrationNote: "Manufacturer documentation describes control from an HTML5 browser over a network connection to the mixer. This is a browser control surface, not a published generic DSP API for this app.",
    validationNeeded: "Confirm the exact Ui model/firmware, LAN address, authentication/session behavior and browser-origin restrictions. Do not assume the mixer web interface is safe to embed or automate.",
  },
  {
    id: "soundcraft-si-vi",
    name: "Soundcraft Si / Vi Series",
    family: "Digital mixing console",
    models: ["Si Compact", "Si Expression", "Si Performer", "Vi Series", "Vi3000"],
    controlStatus: "manual-only",
    transport: "Ethernet · HiQnet network / ViSi Remote ecosystem",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://www.soundcraft.com/en-US/products/visi-remote.html",
    integrationNote: "Manufacturer documentation describes ViSi Remote control for listed Si/Vi console families over Harman HiQnet. HiQnet is not interchangeable with the Ui browser control interface.",
    validationNeeded: "Confirm console software and ViSi compatibility table, configure a dedicated network, and test discovery/access control on the exact model. A generic OSC adapter must not be used.",
  },
  {
    id: "dbx-driverack-pa2",
    name: "dbx DriveRack PA2",
    family: "Loudspeaker management processor",
    models: ["DriveRack PA2"],
    controlStatus: "manual-only",
    transport: "Manufacturer PA2 Control App; no public packet API verified for this app",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/products/driverack-pa2",
    integrationNote: "dbx publishes a dedicated PA2 Control App and owner documentation. This does not establish a supported third-party control protocol for Church Audio AI.",
    validationNeeded: "Confirm firmware, supported official app workflow and available vendor integration interface. Until a public protocol is verified, use manual worksheet/export only.",
  },
  {
    id: "dbx-driverack-venu360",
    name: "dbx DriveRack VENU360",
    family: "Loudspeaker management processor",
    models: ["DriveRack VENU360"],
    controlStatus: "manual-only",
    transport: "Ethernet · vendor VENU360 Control App",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en/product_documents/dbx_driverack_venu360_manual-pdf",
    integrationNote: "The owner manual documents Ethernet connection and a dedicated VENU360 control app. The application does not implement the proprietary command channel.",
    validationNeeded: "Verify direct/network topology, addressing, firmware and exact command protocol from vendor material before implementing read/write operations.",
  },
  {
    id: "dbx-driverack-4800-4820",
    name: "dbx DriveRack 4800 / 4820",
    family: "Loudspeaker management processor",
    models: ["DriveRack 4800", "DriveRack 4820"],
    controlStatus: "manual-only",
    transport: "Ethernet · HiQnet network control",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/products/driverack-4820/features",
    integrationNote: "dbx product documentation lists Ethernet HiQnet networking control for the 4800/4820 family. This is distinct from an open OSC interface.",
    validationNeeded: "Obtain the correct HiQnet integration specification and device software/firmware, then prove read-back, write acknowledgement, reconnect and rollback on each model.",
  },
  {
    id: "db-acoustics-cd48",
    name: "db Acoustics CD48",
    family: "Loudspeaker management processor",
    models: ["db Acoustics CD48 · pictured 100M Ethernet revision (front display Ver 2215)"],
    controlStatus: "manual-only",
    transport: "RJ45 100M Ethernet (shown on supplied rear-panel image) · front USB COM2 · rear R/T/G terminal; LCD image shows IP 192.168.20.20",

    evidenceGrade: "user-supplied-image",
    documentationUrl: "https://dbacoustic.vn/crossover-dbacoustic-cd48",
    integrationNote: "The supplied front/rear images show a db Acoustics CD48 with a rear RJ45 port labelled 100M Ethernet, a front display showing IP 192.168.20.20 and Ver 2215, and a front USB port labelled COM2. This establishes the visible hardware profile in the supplied images. Wi-Fi is provided by an external router/access point; the DSP itself is not assumed to have a Wi-Fi radio. The network command protocol and service port are still unverified.",

    validationNeeded: "Use 192.168.20.20 only as the IP visibly shown in the supplied image; verify the actual LCD address and subnet on the physical unit before connecting. Confirm the Android IP is on the same LAN and that router client isolation is disabled. Obtain the exact CD48 software/protocol specification, service port, authentication and command schema before implementing live control. Do not reuse PH48D or CD4008RTS port counts/defaults. USB COM2 and the rear R/T/G terminal remain alternative vendor control paths pending protocol validation.",

  },
];

export function getDspProfile(id: string): DspProfile | undefined {
  return dspProfiles.find((profile) => profile.id === id);
}
