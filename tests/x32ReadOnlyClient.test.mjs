import test from "node:test";
import assert from "node:assert/strict";
import { X32ReadOnlyClient, X32_OSC_PORT } from "../src/audio/x32ReadOnlyClient.ts";
import { encodeOscMessage, decodeOscMessage } from "../src/audio/x32Osc.ts";

function fakeTransport(handler) {
  const calls = [];
  return {
    calls,
    exchange: async (options) => {
      calls.push(options);
      return handler(options);
    },
  };
}

test("readIdentity sends only /info to UDP 10023 and accepts matching response", async () => {
  const transport = fakeTransport(async (options) => ({
    address: options.host,
    port: X32_OSC_PORT,
    data: encodeOscMessage("/info", [{ type: "s", value: "X32 FW 4.15" }]),
  }));
  const client = new X32ReadOnlyClient(transport);
  const result = await client.readIdentity("192.168.1.40");
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].port, 10023);
  assert.equal(decodeOscMessage(transport.calls[0].payload).address, "/info");
  assert.equal(result.response.args[0], "X32 FW 4.15");
  assert.equal(client.getState(), "ready");
});

test("rejects invalid targets and timeout bounds before transport use", async () => {
  const transport = fakeTransport(async () => { throw new Error("must not run"); });
  const client = new X32ReadOnlyClient(transport);
  await assert.rejects(client.readIdentity("127.0.0.1"), /Invalid X32 IPv4 target/);
  await assert.rejects(client.readIdentity("192.168.1.40", 99), /between 100 and 5000/);
  assert.equal(transport.calls.length, 0);
});

test("rejects responses from a different source address or port", async () => {
  const transport = fakeTransport(async (options) => ({
    address: "192.168.1.41",
    port: X32_OSC_PORT,
    data: encodeOscMessage("/info"),
  }));
  const client = new X32ReadOnlyClient(transport);
  await assert.rejects(client.readIdentity("192.168.1.40"), /source does not match/);
  assert.equal(client.getState(), "error");
});

test("rejects an OSC response with a different address", async () => {
  const transport = fakeTransport(async (options) => ({
    address: options.host,
    port: X32_OSC_PORT,
    data: encodeOscMessage("/status"),
  }));
  const client = new X32ReadOnlyClient(transport);
  await assert.rejects(client.readIdentity("192.168.1.40"), /address does not match/);
  assert.equal(client.getState(), "error");
});

test("classifies transport timeout and resets request lock", async () => {
  let fail = true;
  const transport = fakeTransport(async (options) => {
    if (fail) throw new Error("UDP timeout");
    return {
      address: options.host,
      port: X32_OSC_PORT,
      data: encodeOscMessage("/status"),
    };
  });
  const client = new X32ReadOnlyClient(transport);
  await assert.rejects(client.readStatus("192.168.1.40"), /timeout/i);
  assert.equal(client.getState(), "timeout");
  fail = false;
  await client.readStatus("192.168.1.40");
  assert.equal(client.getState(), "ready");
});

test("does not allow concurrent requests or write paths", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const transport = fakeTransport(async (options) => {
    await pending;
    return {
      address: options.host,
      port: X32_OSC_PORT,
      data: encodeOscMessage("/info"),
    };
  });
  const client = new X32ReadOnlyClient(transport);
  const first = client.readIdentity("192.168.1.40");
  await assert.rejects(client.readStatus("192.168.1.40"), /already in progress/);
  release();
  await first;
  await assert.rejects(client.query("192.168.1.40", "/ch/01/mix/fader/set"), /not in the read-only allowlist/);
});
