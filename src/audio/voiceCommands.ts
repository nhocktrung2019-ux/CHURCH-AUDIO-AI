export type VoiceTabId =
  | "overview"
  | "rta"
  | "room"
  | "align"
  | "system"
  | "design"
  | "tools"
  | "dsp"
  | "support";

export type VoiceIntent =
  | { type: "navigate"; tab: VoiceTabId }
  | { type: "measurement-start" }
  | { type: "measurement-stop" }
  | { type: "rta-frequency"; frequencyHz: number }
  | { type: "help" }
  | { type: "unknown" };

export function normalizeVoiceCommand(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9.,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Local, deterministic command routing. This does not call a cloud AI service. */
export function parseVoiceCommand(value: string): VoiceIntent {
  const command = normalizeVoiceCommand(value);
  if (!command) return { type: "unknown" };

  if (/\b(giup|tro giup|huong dan|help|lenh)\b/.test(command)) {
    return { type: "help" };
  }

  if (/\b(dung do|dung micro|tat micro|stop measurement|stop mic)\b/.test(command)) {
    return { type: "measurement-stop" };
  }

  if (/\b(bat dau do|bat micro|mo micro|start measurement|start mic)\b/.test(command)) {
    return { type: "measurement-start" };
  }

  const frequencyMatch = command.match(
    /(?:tan so|chon tan so|frequency|chon)\s*(\d+(?:[.,]\d+)?)\s*(khz|k hz|hz)?\b|\b(\d+(?:[.,]\d+)?)\s*(khz|k hz|hz)\b/,
  );
  if (frequencyMatch) {
    const raw = (frequencyMatch[1] ?? frequencyMatch[3] ?? "").replace(",", ".");
    const unit = (frequencyMatch[2] ?? frequencyMatch[4] ?? "hz").replace(/\s/g, "");
    const valueHz = Number(raw) * (unit === "khz" ? 1000 : 1);
    if (Number.isFinite(valueHz) && valueHz >= 20 && valueHz <= 20000) {
      return { type: "rta-frequency", frequencyHz: Math.round(valueHz * 10) / 10 };
    }
    return { type: "unknown" };
  }

  if (/\b(tong quan|trang chu|home)\b/.test(command)) return { type: "navigate", tab: "overview" };
  if (/\b(rta|phan tich|pho tan so|spectrogram|waterfall)\b/.test(command)) return { type: "navigate", tab: "rta" };
  if (/\b(rt60|do vang|am hoc phong|reverb)\b/.test(command)) return { type: "navigate", tab: "room" };
  if (/\b(transfer|phase|delay|can chinh|can pha)\b/.test(command)) return { type: "navigate", tab: "align" };
  if (/\b(chong hu|feedback|diem hu|huy riet)\b/.test(command)) return { type: "navigate", tab: "system" };
  if (/\b(3d|phu am|mo phong|c b t|cbt)\b/.test(command)) return { type: "navigate", tab: "design" };
  if (/\b(generator|signal|tin hieu|thiet bi|phat tone)\b/.test(command)) return { type: "navigate", tab: "tools" };
  if (/\b(dsp|mixer|x32|m32|soundcraft|dbx|cd48)\b/.test(command)) return { type: "navigate", tab: "dsp" };
  if (/\b(ho tro|cap nhat|ky thuat|support)\b/.test(command)) return { type: "navigate", tab: "support" };

  return { type: "unknown" };
}

export function describeVoiceIntent(intent: VoiceIntent): string {
  switch (intent.type) {
    case "navigate": return "Đã mở phân hệ " + ({
      overview: "Tổng quan",
      rta: "Phân tích tín hiệu RTA",
      room: "Đo âm học phòng",
      align: "Căn chỉnh hệ thống",
      system: "Chống hú và tối ưu",
      design: "Thiết kế phủ âm 3D",
      tools: "Generator và thiết bị",
      dsp: "DSP và Mixer",
      support: "Cập nhật và hỗ trợ",
    } as const)[intent.tab] + ".";
    case "measurement-start": return "Đang yêu cầu khởi động phép đo microphone.";
    case "measurement-stop": return "Đã yêu cầu dừng phép đo microphone.";
    case "rta-frequency": return "Đã chọn " + intent.frequencyHz.toLocaleString("vi-VN") + " Hz trên RTA.";
    case "help": return "Lệnh: mở RTA/RT60/Transfer/Chống hú/3D/DSP/Hỗ trợ; bắt đầu đo; dừng đo; chọn tần số 1 kHz.";
    default: return "Chưa nhận dạng lệnh. Hãy nói hoặc nhập một lệnh ngắn như “mở RTA”, “bắt đầu đo”, “dừng đo”, “chọn tần số 1 kHz”.";
  }
}
