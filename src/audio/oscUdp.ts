import { Capacitor, registerPlugin } from "@capacitor/core";

export type OscQueryResult = {
  host: string;
  port: number;
  requestedAddress: string;
  responseAddress: string;
  typeTags: string;
  arguments: (string | number | boolean | null)[];
  rawHex: string;
  rttMs: number;
  receivedAt: number;
};

export interface OscUdpPlugin {
  query(options: {
    host: string;
    port?: number;
    address: string;
    timeoutMs?: number;
  }): Promise<OscQueryResult>;
}

export const OscUdp = registerPlugin<OscUdpPlugin>("OscUdp");

export function isOscUdpAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
