/**
 * Small, dependency-free OSC message codec for the Behringer X32 read-only
 * integration foundation. This module performs no network I/O.
 *
 * Deliberately supported OSC argument tags: string, int32, float32 and blob.
 * Unsupported tags/bundles are rejected rather than guessed.
 */
export type OscArgument =
  | { type: "s"; value: string }
  | { type: "i"; value: number }
  | { type: "f"; value: number }
  | { type: "b"; value: Uint8Array };

export type OscDecodedValue = string | number | Uint8Array;

export type OscMessage = {
  address: string;
  typeTags: string;
  args: OscDecodedValue[];
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function paddedLength(length: number): number {
  return (length + 3) & ~3;
}

function writePaddedString(value: string): Uint8Array {
  if (value.includes("\0")) throw new Error("OSC strings cannot contain NUL");
  const encoded = encoder.encode(value);
  const output = new Uint8Array(paddedLength(encoded.length + 1));
  output.set(encoded, 0);
  return output;
}

function readPaddedString(bytes: Uint8Array, start: number): { value: string; next: number } {
  if (!Number.isInteger(start) || start < 0 || start >= bytes.length) {
    throw new Error("OSC string is missing");
  }
  let end = start;
  while (end < bytes.length && bytes[end] !== 0) end += 1;
  if (end === bytes.length) throw new Error("OSC string is not NUL terminated");
  const next = start + paddedLength(end - start + 1);
  if (next > bytes.length) throw new Error("OSC string padding is truncated");
  for (let index = end + 1; index < next; index += 1) {
    if (bytes[index] !== 0) throw new Error("OSC string padding must be zero");
  }
  return { value: decoder.decode(bytes.subarray(start, end)), next };
}

export function encodeOscMessage(address: string, args: OscArgument[] = []): Uint8Array {
  if (!address.startsWith("/") || address.includes("\0")) {
    throw new Error("OSC address must start with '/' and contain no NUL");
  }
  const addressBytes = writePaddedString(address);
  const typeTags = `,${args.map((arg) => arg.type).join("")}`;
  const typeBytes = writePaddedString(typeTags);
  const chunks: Uint8Array[] = [addressBytes, typeBytes];

  for (const arg of args) {
    if (arg.type === "s") {
      chunks.push(writePaddedString(arg.value));
    } else if (arg.type === "i" || arg.type === "f") {
      if (!Number.isFinite(arg.value)) throw new Error("OSC numeric arguments must be finite");
      if (arg.type === "i" && (!Number.isInteger(arg.value) || arg.value < -2147483648 || arg.value > 2147483647)) {
        throw new Error("OSC int32 argument is out of range");
      }
      const chunk = new Uint8Array(4);
      const view = new DataView(chunk.buffer);
      if (arg.type === "i") view.setInt32(0, arg.value, false);
      else view.setFloat32(0, arg.value, false);
      chunks.push(chunk);
    } else {
      const length = arg.value.byteLength;
      const chunk = new Uint8Array(4 + paddedLength(length));
      new DataView(chunk.buffer).setInt32(0, length, false);
      chunk.set(arg.value, 4);
      chunks.push(chunk);
    }
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const packet = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    packet.set(chunk, offset);
    offset += chunk.length;
  }
  return packet;
}

export function decodeOscMessage(packet: Uint8Array): OscMessage {
  if (!(packet instanceof Uint8Array) || packet.byteLength < 8 || packet.byteLength % 4 !== 0) {
    throw new Error("OSC message must be a non-empty, 4-byte-aligned packet");
  }
  const address = readPaddedString(packet, 0);
  if (!address.value.startsWith("/")) throw new Error("OSC address is invalid");
  const tags = readPaddedString(packet, address.next);
  if (!tags.value.startsWith(",")) throw new Error("OSC type-tag string is missing");
  const args: OscDecodedValue[] = [];
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  let offset = tags.next;

  for (const tag of tags.value.slice(1)) {
    if (tag === "s") {
      const value = readPaddedString(packet, offset);
      args.push(value.value);
      offset = value.next;
    } else if (tag === "i" || tag === "f") {
      if (offset + 4 > packet.byteLength) throw new Error("OSC numeric argument is truncated");
      const value = tag === "i" ? view.getInt32(offset, false) : view.getFloat32(offset, false);
      if (!Number.isFinite(value)) throw new Error("OSC numeric argument is not finite");
      args.push(value);
      offset += 4;
    } else if (tag === "b") {
      if (offset + 4 > packet.byteLength) throw new Error("OSC blob length is truncated");
      const length = view.getInt32(offset, false);
      if (length < 0) throw new Error("OSC blob length cannot be negative");
      const dataStart = offset + 4;
      const dataEnd = dataStart + length;
      const paddedEnd = dataStart + paddedLength(length);
      if (paddedEnd > packet.byteLength) throw new Error("OSC blob is truncated");
      for (let index = dataEnd; index < paddedEnd; index += 1) {
        if (packet[index] !== 0) throw new Error("OSC blob padding must be zero");
      }
      args.push(packet.slice(dataStart, dataEnd));
      offset = paddedEnd;
    } else {
      throw new Error(`Unsupported OSC type tag: ${tag}`);
    }
  }

  if (offset !== packet.byteLength) throw new Error("OSC message contains unexpected trailing bytes");
  return { address: address.value, typeTags: tags.value, args };
}

export function isValidX32Ipv4Target(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  if (octets.every((octet) => octet === 0)) return false;
  if (octets[0] === 127 || octets[0] >= 224 || octets[0] === 0) return false;
  if (octets.every((octet) => octet === 255)) return false;
  return true;
}

const READ_ONLY_X32_PATHS = [
  /^\/(?:info|status)$/,
  /^\/ch\/(?:0[1-9]|[12][0-9]|3[0-2])\/mix\/(?:fader|on)$/,
  /^\/bus\/(?:0[1-9]|1[0-6])\/mix\/fader$/,
  /^\/main\/st\/mix\/fader$/,
];

/**
 * Build an OSC query with no arguments. Paths outside the narrow read-only
 * allowlist are rejected. No setter API is provided by this module.
 */
export function buildX32ReadOnlyRequest(path: string): Uint8Array {
  if (!READ_ONLY_X32_PATHS.some((pattern) => pattern.test(path))) {
    throw new Error("X32 path is not in the read-only allowlist");
  }
  return encodeOscMessage(path);
}
