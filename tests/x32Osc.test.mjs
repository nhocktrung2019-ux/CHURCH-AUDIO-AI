import test from "node:test";
import assert from "node:assert/strict";
import {
  buildX32ReadOnlyRequest,
  decodeOscMessage,
  encodeOscMessage,
  isValidX32Ipv4Target,
} from "../src/audio/x32Osc.ts";

test("encodes X32 /info as a padded OSC query with no arguments", () => {
  const packet = encodeOscMessage("/info");
  assert.equal(packet.length % 4, 0);
  assert.deepEqual([...packet], [
    0x2f, 0x69, 0x6e, 0x66, 0x6f, 0x00, 0x00, 0x00,
    0x2c, 0x00, 0x00, 0x00,
  ]);
  assert.deepEqual(decodeOscMessage(packet), { address: "/info", typeTags: ",", args: [] });
});

test("round-trips OSC string, int32, float32 and blob arguments", () => {
  const packet = encodeOscMessage("/test", [
    { type: "s", value: "X32" },
    { type: "i", value: -12 },
    { type: "f", value: 0.5 },
    { type: "b", value: new Uint8Array([1, 2, 3]) },
  ]);
  const decoded = decodeOscMessage(packet);
  assert.equal(decoded.address, "/test");
  assert.equal(decoded.typeTags, ",sifb");
  assert.deepEqual(decoded.args.slice(0, 3), ["X32", -12, 0.5]);
  assert.deepEqual(Array.from(decoded.args[3]), [1, 2, 3]);
});

test("rejects malformed packets, unsupported tags and non-finite values", () => {
  assert.throws(() => decodeOscMessage(new Uint8Array([1, 2, 3])));
  assert.throws(() => encodeOscMessage("/x", [{ type: "f", value: Number.NaN }]));
  assert.throws(() => encodeOscMessage("/x", [{ type: "i", value: 1.5 }]));
  assert.throws(() => decodeOscMessage(new Uint8Array([
    0x2f, 0x78, 0x00, 0x00, 0x2c, 0x7a, 0x00, 0x00,
  ])));
});

test("read-only request builder permits identity/status and approved query paths only", () => {
  for (const path of ["/info", "/status", "/ch/01/mix/fader", "/ch/32/mix/on", "/bus/16/mix/fader"]) {
    assert.equal(decodeOscMessage(buildX32ReadOnlyRequest(path)).address, path);
  }
  for (const path of ["/ch/01/mix/fader/set", "/ch/33/mix/fader", "/ch/01/config/name", "/scene/load"]) {
    assert.throws(() => buildX32ReadOnlyRequest(path));
  }
});

test("validates IPv4 destinations and rejects unsafe special ranges", () => {
  assert.equal(isValidX32Ipv4Target("192.168.1.40"), true);
  assert.equal(isValidX32Ipv4Target("10.0.0.5"), true);
  for (const ip of ["", "localhost", "192.168.1", "256.1.1.1", "0.0.0.0", "127.0.0.1", "224.0.0.1", "255.255.255.255", "01.2.3.4"]) {
    assert.equal(isValidX32Ipv4Target(ip), false, ip);
  }
});
