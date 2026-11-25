import {
  buildX32ReadOnlyRequest,
  decodeOscMessage,
  isValidX32Ipv4Target,
  type OscMessage,
} from "./x32Osc.ts";

export const X32_OSC_PORT = 10023;
export const X32_DEFAULT_TIMEOUT_MS = 1200;
export const X32_MAX_TIMEOUT_MS = 5000;

export type X32Datagram = {
  address: string;
  port: number;
  data: Uint8Array;
};

export interface X32DatagramTransport {
  exchange(options: {
    host: string;
    port: number;
    payload: Uint8Array;
    timeoutMs: number;
  }): Promise<X32Datagram>;
}

export type X32ConnectionState = "idle" | "querying" | "ready" | "timeout" | "error";

export type X32QueryResult = {
  state: "ready";
  host: string;
  port: number;
  response: OscMessage;
  receivedAt: number;
};

export class X32ReadOnlyClient {
  private state: X32ConnectionState = "idle";
  private busy = false;

  constructor(private readonly transport: X32DatagramTransport) {}

  getState(): X32ConnectionState {
    return this.state;
  }

  async query(
    host: string,
    path: string,
    timeoutMs = X32_DEFAULT_TIMEOUT_MS,
  ): Promise<X32QueryResult> {
    if (!isValidX32Ipv4Target(host)) {
      this.state = "error";
      throw new Error("Invalid X32 IPv4 target");
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > X32_MAX_TIMEOUT_MS) {
      this.state = "error";
      throw new Error("Timeout must be an integer between 100 and 5000 ms");
    }
    if (this.busy) {
      throw new Error("An X32 request is already in progress");
    }

    this.busy = true;
    this.state = "querying";
    try {
      const payload = buildX32ReadOnlyRequest(path);
      const datagram = await this.transport.exchange({
        host,
        port: X32_OSC_PORT,
        payload,
        timeoutMs,
      });

      if (datagram.address !== host || datagram.port !== X32_OSC_PORT) {
        throw new Error("X32 response source does not match the configured device");
      }
      const response = decodeOscMessage(datagram.data);
      if (response.address !== path) {
        throw new Error("X32 response OSC address does not match the request");
      }

      this.state = "ready";
      return {
        state: "ready",
        host,
        port: X32_OSC_PORT,
        response,
        receivedAt: Date.now(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = /timeout/i.test(message) ? "timeout" : "error";
      throw error;
    } finally {
      this.busy = false;
    }
  }

  async readIdentity(host: string, timeoutMs = X32_DEFAULT_TIMEOUT_MS): Promise<X32QueryResult> {
    return this.query(host, "/info", timeoutMs);
  }

  async readStatus(host: string, timeoutMs = X32_DEFAULT_TIMEOUT_MS): Promise<X32QueryResult> {
    return this.query(host, "/status", timeoutMs);
  }
}
