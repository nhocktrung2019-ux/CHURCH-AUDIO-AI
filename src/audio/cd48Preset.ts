export type CD48ChannelKind = "input" | "output";
export type CD48PeqBand = { frequencyHz: number; gainDb: number; q: number };
export type CD48ChannelDraft = {
  id: string;
  kind: CD48ChannelKind;
  gainDb: number;
  delayMs: number;
  polarityInverted: boolean;
  muted: boolean;
  peq: Array<CD48PeqBand | null>;
};
export type CD48PresetDraft = {
  schema: "church-audio-cd48-preset-draft/v1";
  model: "db-acoustics-cd48";
  modelEvidence: "user-supplied-image";
  deviceIp: string;
  firmwareLabel: string;
  sceneSlot: number;
  inputs: CD48ChannelDraft[];
  outputs: CD48ChannelDraft[];
  matrix: boolean[][];
  hardwareWriteEnabled: false;
  notes: string;
};

const makeChannel = (kind: CD48ChannelKind, number: number): CD48ChannelDraft => ({
  id: `${kind === "input" ? "IN" : "OUT"}${number}`,
  kind,
  gainDb: 0,
  delayMs: 0,
  polarityInverted: false,
  muted: false,
  peq: Array.from({ length: 11 }, () => null),
});

export function createCD48PresetDraft(): CD48PresetDraft {
  return {
    schema: "church-audio-cd48-preset-draft/v1",
    model: "db-acoustics-cd48",
    modelEvidence: "user-supplied-image",
    deviceIp: "192.168.20.20",
    firmwareLabel: "Ver 2215 (đọc từ ảnh; cần đối chiếu thiết bị thật)",
    sceneSlot: 1,
    inputs: Array.from({ length: 4 }, (_, i) => makeChannel("input", i + 1)),
    outputs: Array.from({ length: 8 }, (_, i) => makeChannel("output", i + 1)),
    // Safe default: no signal routes are enabled until the technician explicitly maps them.
    matrix: Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => false)),
    hardwareWriteEnabled: false,
    notes: "",
  };
}

export type CD48PresetIssue = { path: string; message: string };

export function validateCD48PresetDraft(draft: CD48PresetDraft): CD48PresetIssue[] {
  const issues: CD48PresetIssue[] = [];
  if (draft.schema !== "church-audio-cd48-preset-draft/v1") issues.push({ path: "schema", message: "Sai phiên bản schema." });
  if (draft.model !== "db-acoustics-cd48") issues.push({ path: "model", message: "Sai model DSP." });
  if (draft.modelEvidence !== "user-supplied-image") issues.push({ path: "modelEvidence", message: "Phải giữ nguồn bằng chứng ảnh thiết bị." });
  if (!Number.isInteger(draft.sceneSlot) || draft.sceneSlot < 1 || draft.sceneSlot > 128) issues.push({ path: "sceneSlot", message: "Scene phải nằm trong khoảng 1–128." });
  if (!/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(draft.deviceIp)) issues.push({ path: "deviceIp", message: "Địa chỉ IPv4 không hợp lệ." });
  if (draft.inputs.length !== 4 || draft.outputs.length !== 8) issues.push({ path: "channels", message: "CD48 yêu cầu đúng 4 input và 8 output." });
  if (draft.matrix.length !== 4 || draft.matrix.some((row) => row.length !== 8)) issues.push({ path: "matrix", message: "Matrix phải có 4 hàng × 8 cột." });
  for (const channel of [...draft.inputs, ...draft.outputs]) {
    if (!Number.isFinite(channel.gainDb)) issues.push({ path: `${channel.id}.gainDb`, message: "Gain phải là số hữu hạn." });
    if (!Number.isFinite(channel.delayMs) || channel.delayMs < 0 || channel.delayMs > 2000) issues.push({ path: `${channel.id}.delayMs`, message: "Delay phải từ 0 đến 2000 ms theo thông số CD48." });
    if (channel.peq.length !== 11) issues.push({ path: `${channel.id}.peq`, message: "Mỗi kênh chỉ khai báo tối đa 11 band PEQ." });
    channel.peq.forEach((band, index) => {
      if (!band) return;
      if (!Number.isFinite(band.frequencyHz) || band.frequencyHz < 20 || band.frequencyHz > 20000) issues.push({ path: `${channel.id}.peq[${index}].frequencyHz`, message: "Tần số PEQ phải trong dải 20 Hz–20 kHz." });
      if (!Number.isFinite(band.gainDb)) issues.push({ path: `${channel.id}.peq[${index}].gainDb`, message: "Gain PEQ phải là số hữu hạn." });
      if (!Number.isFinite(band.q) || band.q <= 0) issues.push({ path: `${channel.id}.peq[${index}].q`, message: "Q phải lớn hơn 0." });
    });
  }
  if (draft.hardwareWriteEnabled !== false) issues.push({ path: "hardwareWriteEnabled", message: "Bản nháp không được phép ghi trực tiếp phần cứng." });
  return issues;
}
