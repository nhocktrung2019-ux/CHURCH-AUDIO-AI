/**
 * CD48 Ver. 2215 central-control command catalogue.
 *
 * Source: operator-supplied "Digital Audio Processor Central Control Protocol Table.xls".
 * The spreadsheet explicitly labels these commands RS232 and specifies 115200 baud.
 *
 * This module ONLY builds documented ASCII command strings. It does not open a
 * serial port, send bytes, implement Ethernet, or infer acknowledgements/readback.
 */

export type Cd48CommandKind =
  | "global-mute"
  | "input-mute"
  | "input-gain-step"
  | "output-mute"
  | "output-gain-step"
  | "scene-recall"
  | "input-group-mute"
  | "input-group-volume-step"
  | "output-group-mute"
  | "output-group-volume-step";

export type Cd48Risk = "high-impact";

export interface Cd48Command {
  device: "dbAcoustics CD48";
  firmwareLabel: "Ver. 2215";
  transport: "RS232";
  baudRate: 115200;
  kind: Cd48CommandKind;
  command: string;
  asciiHex: string;
  risk: Cd48Risk;
  requiresExplicitConfirmation: true;
  readbackSupportedBySuppliedTable: false;
}

function assertIntegerInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}`);
  }
}

function asciiHex(command: string): string {
  for (let i = 0; i < command.length; i += 1) {
    if (command.charCodeAt(i) > 0x7f) {
      throw new TypeError("CD48 command must contain ASCII characters only");
    }
  }
  return Array.from(command, (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase(),
  ).join(" ");
}

function build(kind: Cd48CommandKind, command: string): Cd48Command {
  return {
    device: "dbAcoustics CD48",
    firmwareLabel: "Ver. 2215",
    transport: "RS232",
    baudRate: 115200,
    kind,
    command,
    asciiHex: asciiHex(command),
    risk: "high-impact",
    requiresExplicitConfirmation: true,
    readbackSupportedBySuppliedTable: false,
  };
}

function boolText(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}

function signedStep(direction: "up" | "down"): "1.00" | "-1.00" {
  return direction === "up" ? "1.00" : "-1.00";
}

function percentStep(direction: "up" | "down"): "1" | "-1" {
  return direction === "up" ? "1" : "-1";
}

export const cd48Rs232 = {
  globalMute(muted: boolean): Cd48Command {
    return build(
      "global-mute",
      `setnr 0 d0/data/d0/pros/gnOut0/arg/allMute ${boolText(muted)} 0;`,
    );
  },

  inputMute(channel: number, muted: boolean): Cd48Command {
    assertIntegerInRange(channel, 1, 4, "Input channel");
    return build(
      "input-mute",
      `setnr 0 d0/data/d0/pros/gnIn0/arg/chns/${channel - 1}/mute ${boolText(muted)} 0;`,
    );
  },

  inputGainStep(channel: number, direction: "up" | "down"): Cd48Command {
    assertIntegerInRange(channel, 1, 4, "Input channel");
    return build(
      "input-gain-step",
      `setnr 0 d0/data/d0/pros/gnIn0/arg/chns/${channel - 1}/incGain ${signedStep(direction)} 0;`,
    );
  },

  outputMute(channel: number, muted: boolean): Cd48Command {
    assertIntegerInRange(channel, 1, 8, "Output channel");
    return build(
      "output-mute",
      `setnr 0 d0/data/d0/pros/gnOut0/arg/chns/${channel - 1}/mute ${boolText(muted)} 0;`,
    );
  },

  outputGainStep(channel: number, direction: "up" | "down"): Cd48Command {
    assertIntegerInRange(channel, 1, 8, "Output channel");
    return build(
      "output-gain-step",
      `setnr 0 d0/data/d0/pros/gnOut0/arg/chns/${channel - 1}/incGain ${signedStep(direction)} 0;`,
    );
  },

  recallScene(scene: number): Cd48Command {
    assertIntegerInRange(scene, 1, 8, "Scene");
    return build(
      "scene-recall",
      `setnr 0 m/dev/arg/autoFiles/scene/curId ${scene - 1} 0;`,
    );
  },

  inputGroupMute(group: number, muted: boolean): Cd48Command {
    assertIntegerInRange(group, 1, 4, "Input group");
    return build(
      "input-group-mute",
      `setnr 0 d0/data/d0/pros/gnIn0/arg/groups/${group - 1}/mute ${boolText(muted)} 0;`,
    );
  },

  inputGroupVolumeStep(group: number, direction: "up" | "down"): Cd48Command {
    assertIntegerInRange(group, 1, 4, "Input group");
    return build(
      "input-group-volume-step",
      `setnr 0 d0/data/d0/pros/gnIn0/arg/groups/${group - 1}/incPercent ${percentStep(direction)} 0;`,
    );
  },

  outputGroupMute(group: number, muted: boolean): Cd48Command {
    assertIntegerInRange(group, 1, 4, "Output group");
    return build(
      "output-group-mute",
      `setnr 0 d0/data/d0/pros/gnOut0/arg/groups/${group - 1}/mute ${boolText(muted)} 0;`,
    );
  },

  outputGroupVolumeStep(group: number, direction: "up" | "down"): Cd48Command {
    assertIntegerInRange(group, 1, 4, "Output group");
    return build(
      "output-group-volume-step",
      `setnr 0 d0/data/d0/pros/gnOut0/arg/groups/${group - 1}/incPercent ${percentStep(direction)} 0;`,
    );
  },
};

export function isCd48Rs232Command(value: unknown): value is Cd48Command {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Cd48Command>;
  if (
    candidate.device !== "dbAcoustics CD48"
    || candidate.firmwareLabel !== "Ver. 2215"
    || candidate.transport !== "RS232"
    || candidate.baudRate !== 115200
    || typeof candidate.command !== "string"
    || !candidate.command.startsWith("setnr ")
    || !candidate.command.endsWith(";")
    || candidate.requiresExplicitConfirmation !== true
    || candidate.readbackSupportedBySuppliedTable !== false
  ) return false;

  try {
    return candidate.asciiHex === asciiHex(candidate.command);
  } catch {
    return false;
  }
}
