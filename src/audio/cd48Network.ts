export type CD48NetworkLink = "ethernet" | "wifi-lan";
export type CD48HardwareRevision =
  | "unverified"
  | "standard-usb-rs232"
  | "rj45-confirmed"
  | "cd48-100m-rj45-observed";

/** Visible reference details from the user-supplied CD48 product images. */
export const CD48_IMAGE_REFERENCE = {
  modelLabel: "db Acoustics CD48",
  rearNetworkPort: "RJ45 100M Ethernet",
  ethernetSpeedMbps: 100,
  frontDisplayIp: "192.168.20.20",
  frontDisplayVersion: "2215",
  frontUsbLabel: "COM2",
} as const;

export type CD48NetworkConfig = {
  hardwareRevision: CD48HardwareRevision;
  link: CD48NetworkLink;
  deviceIp: string;
  controllerIp: string;
  subnetPrefix: number;
};

export type CD48NetworkAssessment = {
  status:
    | "needs-rj45-confirmation"
    | "invalid-address"
    | "invalid-subnet"
    | "different-subnet"
    | "same-subnet-protocol-unverified";
  sameSubnet: boolean;
  mayUseLanPath: boolean;
  message: string;
};

export function parseIPv4(value: string): number | null {
  if (typeof value !== "string") return null;
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    result = ((result << 8) | octet) >>> 0;
  }
  return result >>> 0;
}

export function isValidLanSubnetPrefix(prefix: number): boolean {
  return Number.isInteger(prefix) && prefix >= 1 && prefix <= 30;
}

export function areIPv4AddressesInSameSubnet(
  firstAddress: string,
  secondAddress: string,
  prefix: number,
): boolean | null {
  const first = parseIPv4(firstAddress);
  const second = parseIPv4(secondAddress);
  if (first === null || second === null || !isValidLanSubnetPrefix(prefix)) return null;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return ((first & mask) >>> 0) === ((second & mask) >>> 0);
}

/**
 * Checks only manually entered network addressing. It does NOT ping, scan,
 * discover, authenticate to, or send commands to the processor. The protocol
 * and service port remain unknown until the exact CD48 revision/vendor docs
 * establish them.
 */
export function assessCD48NetworkConfig(config: CD48NetworkConfig): CD48NetworkAssessment {
  const rj45Confirmed = config.hardwareRevision === "rj45-confirmed"
    || config.hardwareRevision === "cd48-100m-rj45-observed";
  if (!rj45Confirmed) {
    return {
      status: "needs-rj45-confirmation",
      sameSubnet: false,
      mayUseLanPath: false,
      message: config.hardwareRevision === "standard-usb-rs232"
        ? "Bản CD48 này được xác định không có RJ45; dùng USB/RS232 hoặc xác minh đúng model khác."
        : "Chưa xác nhận cổng RJ45 vật lý trên đúng thiết bị. Không bật cấu hình LAN cho đến khi kiểm tra mặt sau/mã model.",
    };
  }
  const device = parseIPv4(config.deviceIp);
  const controller = parseIPv4(config.controllerIp);
  if (device === null || controller === null) {
    return {
      status: "invalid-address",
      sameSubnet: false,
      mayUseLanPath: false,
      message: "Nhập địa chỉ IPv4 hợp lệ của CD48 và điện thoại/thiết bị điều khiển.",
    };
  }
  if (!isValidLanSubnetPrefix(config.subnetPrefix)) {
    return {
      status: "invalid-subnet",
      sameSubnet: false,
      mayUseLanPath: false,
      message: "Subnet prefix phải từ /1 đến /30; nhập đúng subnet mask của mạng đang dùng.",
    };
  }
  const sameSubnet = areIPv4AddressesInSameSubnet(
    config.deviceIp,
    config.controllerIp,
    config.subnetPrefix,
  );
  if (sameSubnet !== true) {
    return {
      status: "different-subnet",
      sameSubnet: false,
      mayUseLanPath: false,
      message: "Hai địa chỉ không cùng subnet. Kiểm tra IP, subnet mask, VLAN, guest Wi-Fi hoặc client isolation trên router.",
    };
  }
  return {
    status: "same-subnet-protocol-unverified",
    sameSubnet: true,
    mayUseLanPath: true,
    message: config.link === "wifi-lan"
      ? "Địa chỉ cùng subnet: điện thoại có thể đi qua Wi-Fi của router đến LAN có dây của CD48. Chưa xác nhận thiết bị phản hồi hay giao thức điều khiển."
      : "Địa chỉ cùng subnet: đường Ethernet có cấu hình IP phù hợp. Chưa xác nhận thiết bị phản hồi hay giao thức điều khiển.",
  };
}
