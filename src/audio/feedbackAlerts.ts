import type { FeedbackCandidate } from "./feedback";

export type VietnameseFeedbackAlert = {
  severity: "clear" | "watch" | "high";
  title: string;
  summary: string;
  recommendation: string;
};

function formatFrequencyVi(frequencyHz: number): string {
  if (!Number.isFinite(frequencyHz)) return "không xác định";
  return frequencyHz >= 1000
    ? (frequencyHz / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " kHz"
    : Math.round(frequencyHz).toLocaleString("vi-VN") + " Hz";
}

/**
 * Vietnamese, text-only acoustic feedback warning.
 * A persistent narrow peak is an advisory indicator, not proof of a closed
 * acoustic feedback loop. Severity intentionally avoids absolute dBFS thresholds
 * because dBFS is not calibrated SPL.
 */
export function describeVietnameseFeedbackAlert(
  candidates: readonly FeedbackCandidate[],
): VietnameseFeedbackAlert {
  if (!candidates.length) {
    return {
      severity: "clear",
      title: "Chưa phát hiện dấu hiệu hú rít",
      summary: "Chưa có đỉnh tần số hẹp ổn định vượt ngưỡng cảnh báo trong các khung RTA gần nhất.",
      recommendation: "Tiếp tục theo dõi khi tăng gain từ từ và mở từng micro.",
    };
  }

  const strongest = [...candidates].sort((a, b) => b.prominenceDb - a.prominenceDb)[0];
  const high = candidates.some(
    (candidate) =>
      candidate.confidence === "high" &&
      candidate.persistence >= 85 &&
      candidate.prominenceDb >= 8,
  );
  const frequencies = [...candidates]
    .sort((a, b) => b.prominenceDb - a.prominenceDb)
    .slice(0, 3)
    .map((candidate) => formatFrequencyVi(candidate.frequencyHz))
    .join(" · ");

  return {
    severity: high ? "high" : "watch",
    title: high ? "Cảnh báo cao: nghi có hú rít" : "Cần kiểm tra: có đỉnh tần số bất thường",
    summary:
      "Phát hiện " + candidates.length + " đỉnh hẹp; tần số nổi bật: " + frequencies +
      ". Đỉnh mạnh nhất cao hơn nền " + strongest.prominenceDb.toFixed(1) +
      " dB và xuất hiện trong " + strongest.persistence + "% khung đo. Đây là dấu hiệu nghi vấn, chưa phải xác nhận vòng hú.",
    recommendation: high
      ? "Hạ gain kênh hoặc monitor liên quan; kiểm tra từng micro, hướng loa và vị trí micro. Không tăng âm lượng và không tự động áp EQ."
      : "Kiểm tra lại bằng cách nghe và cô lập từng micro/kênh; ưu tiên chỉnh gain, khoảng cách và hướng micro trước khi notch EQ.",
  };
}
