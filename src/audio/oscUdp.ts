import { Capacitor, registerPlugin } from "@capacitor/core";

export type OscValue = string | number | boolean | null;

export type OscQueryResult = {
  host: string;
  port: number;
  requestedAddress: string;
  responseAddress: string;
  typeTags: string;
  arguments: OscValue[];
  rawHex: string;
  rttMs: number;
  receivedAt: number;
};

export type OscBatchQueryResult = {
  host: string;
  port: number;
  requestedCount: number;
  receivedCount: number;
  missingCount: number;
  results: OscQueryResult[];
  elapsedMs: number;
  completedAt: number;
};

export interface OscUdpPlugin {
  query(options: {
    host: string;
    port?: number;
    address: string;
    timeoutMs?: number;
  }): Promise<OscBatchQueryResult>;
  queryBatch(options: {
    host: string;
    port?: number;
    addresses: string[];
    timeoutMs?: number;
  }): Promise<OscBatchQueryResult>;
  writeGuarded(options: {
    host: string;
    port?: number;
    address: string;
    expectedRawValue: number;
    value: number;
    timeoutMs?: number;
  }): Promise<{
    host: string;
    port: number;
    address: string;
    sent: boolean;
    verified: boolean;
    beforeRawValue?: number;
    requestedValue?: number;
    wireValue?: number;
    afterRawValue?: number | null;
    status: "verified" | "sent-unverified";
    warning?: string;
    elapsedMs: number;
    completedAt?: number;
  }>;
}

export const OscUdp = registerPlugin<OscUdpPlugin>("OscUdp");

export function isOscUdpAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
