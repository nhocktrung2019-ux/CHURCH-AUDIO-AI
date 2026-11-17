import test from "node:test";
import assert from "node:assert/strict";
import {
  areIPv4AddressesInSameSubnet,
  assessCD48NetworkConfig,
  isValidLanSubnetPrefix,
  parseIPv4,
  CD48_IMAGE_REFERENCE,
} from "../src/audio/cd48Network.ts";

const base = {
  hardwareRevision: "cd48-100m-rj45-observed",
  link: "ethernet",
  deviceIp: "192.168.20.20",
  controllerIp: "192.168.20.51",
  subnetPrefix: 24,
};

test("parses strict dotted IPv4 addresses", () => {
  assert.notEqual(parseIPv4("192.168.20.20"), null);
  assert.notEqual(parseIPv4("0.0.0.0"), null);
  assert.equal(parseIPv4("192.168.20"), null);
  assert.equal(parseIPv4("192.168.20.256"), null);
  assert.equal(parseIPv4("192.168.020.20"), null);
  assert.equal(parseIPv4("192.168.-1.20"), null);
});

test("validates practical LAN subnet prefixes", () => {
  assert.equal(isValidLanSubnetPrefix(24), true);
  assert.equal(isValidLanSubnetPrefix(1), true);
  assert.equal(isValidLanSubnetPrefix(30), true);
  assert.equal(isValidLanSubnetPrefix(0), false);
  assert.equal(isValidLanSubnetPrefix(31), false);
  assert.equal(isValidLanSubnetPrefix(24.5), false);
});

test("compares same-subnet and different-subnet IPv4 addresses", () => {
  assert.equal(areIPv4AddressesInSameSubnet("192.168.20.20", "192.168.20.51", 24), true);
  assert.equal(areIPv4AddressesInSameSubnet("192.168.20.20", "192.168.21.51", 24), false);
  assert.equal(areIPv4AddressesInSameSubnet("10.1.5.20", "10.1.9.51", 16), true);
  assert.equal(areIPv4AddressesInSameSubnet("10.1.5.20", "10.2.9.51", 16), false);
  assert.equal(areIPv4AddressesInSameSubnet("bad", "10.2.9.51", 16), null);
});

test("does not enable LAN until a physical RJ45 port is confirmed", () => {
  const unknown = assessCD48NetworkConfig({ ...base, hardwareRevision: "unverified" });
  assert.equal(unknown.status, "needs-rj45-confirmation");
  assert.equal(unknown.mayUseLanPath, false);
  const standard = assessCD48NetworkConfig({ ...base, hardwareRevision: "standard-usb-rs232" });
  assert.equal(standard.status, "needs-rj45-confirmation");
  assert.equal(standard.mayUseLanPath, false);
});

test("reports valid Ethernet addressing without claiming a live device connection", () => {
  const result = assessCD48NetworkConfig(base);
  assert.equal(result.status, "same-subnet-protocol-unverified");
  assert.equal(result.mayUseLanPath, true);
  assert.match(result.message, /Chưa xác nhận thiết bị phản hồi/);
});

test("Wi-Fi LAN uses the same routed subnet check as wired Ethernet", () => {
  const result = assessCD48NetworkConfig({ ...base, link: "wifi-lan" });
  assert.equal(result.status, "same-subnet-protocol-unverified");
  assert.equal(result.mayUseLanPath, true);
  assert.match(result.message, /Wi-Fi của router/);
});

test("rejects invalid addresses and subnet configuration", () => {
  assert.equal(assessCD48NetworkConfig({ ...base, deviceIp: "192.168.20.999" }).status, "invalid-address");
  assert.equal(assessCD48NetworkConfig({ ...base, subnetPrefix: 31 }).status, "invalid-subnet");
  assert.equal(assessCD48NetworkConfig({ ...base, controllerIp: "192.168.21.51" }).status, "different-subnet");
});

test("uses the submitted CD48 visual reference for Ethernet profile details", () => {
  assert.equal(CD48_IMAGE_REFERENCE.rearNetworkPort, "RJ45 100M Ethernet");
  assert.equal(CD48_IMAGE_REFERENCE.ethernetSpeedMbps, 100);
  assert.equal(CD48_IMAGE_REFERENCE.frontDisplayIp, "192.168.20.20");
  assert.equal(CD48_IMAGE_REFERENCE.frontDisplayVersion, "2215");
  assert.equal(CD48_IMAGE_REFERENCE.frontUsbLabel, "COM2");
  const result = assessCD48NetworkConfig(base);
  assert.equal(result.mayUseLanPath, true);
});
