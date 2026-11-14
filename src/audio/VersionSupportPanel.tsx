import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Activity, ClipboardCopy, Download, ExternalLink, FileCheck2, Headset, ShieldCheck, Wrench } from "lucide-react";
import {
  APP_CHANNEL,
  APP_RELEASES_URL,
  APP_SUPPORT_DOCS_URL,
  APP_SUPPORT_URL,
  APP_VERSION,
} from "../appVersion";

async function collectDiagnosticReport(): Promise<string> {
  const mediaDevices = navigator.mediaDevices;
  let inputCount = "Không khả dụng";
  let outputCount = "Không khả dụng";

  if (mediaDevices?.enumerateDevices) {
    try {
      const devices = await mediaDevices.enumerateDevices();
      inputCount = String(devices.filter((device) => device.kind === "audioinput").length);
      outputCount = String(devices.filter((device) => device.kind === "audiooutput").length);
    } catch {
      inputCount = "Không đọc được (có thể chưa cấp quyền)";
      outputCount = "Không đọc được";
    }
  }

  const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const audioContextSupported =
    typeof window.AudioContext !== "undefined" ||
    typeof extendedWindow.webkitAudioContext !== "undefined";

  return [
    "CHURCH AUDIO ANALYZER — TECHNICAL SUPPORT DIAGNOSTICS",
    `App version: ${APP_VERSION}`,
    `Update channel: ${APP_CHANNEL}`,
    `Platform: ${Capacitor.getPlatform()}`,
    `Generated: ${new Date().toISOString()}`,
    `Online: ${navigator.onLine ? "yes" : "no"}`,
    `Secure context: ${window.isSecureContext ? "yes" : "no"}`,
    `MediaDevices API: ${mediaDevices ? "available" : "unavailable"}`,
    `Microphone capture API: ${mediaDevices?.getUserMedia ? "available" : "unavailable"}`,
    `AudioContext API: ${audioContextSupported ? "available" : "unavailable"}`,
    `Enumerated audio inputs: ${inputCount}`,
    `Enumerated audio outputs: ${outputCount}`,
    `Language: ${navigator.language || "unknown"}`,
    `User agent: ${navigator.userAgent || "unknown"}`,
    "",
    "Privacy: this report contains no audio recording, device names, device IDs, passwords or access tokens.",
  ].join("\n");
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "true");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Trình duyệt không cho phép sao chép tự động.");
}

export default function VersionSupportPanel() {
  const [report, setReport] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const generateReport = async () => {
    setBusy(true);
    setNotice("");
    try {
      const nextReport = await collectDiagnosticReport();
      setReport(nextReport);
      return nextReport;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo báo cáo thiết bị.");
      return "";
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const nextReport = await generateReport();
    if (!nextReport) return;
    try {
      await copyText(nextReport);
      setNotice("Đã sao chép báo cáo. Hãy rà soát nội dung trước khi gửi cho kỹ thuật.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể sao chép báo cáo.");
    }
  };

  const handleDownload = async () => {
    const nextReport = await generateReport();
    if (!nextReport) return;
    const blob = new Blob([nextReport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `church-audio-diagnostics-v${APP_VERSION}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Đã tạo tệp báo cáo chẩn đoán trên thiết bị.");
  };

  return (
    <section className="version-support-workspace">
      <article className="panel update-panel">
        <div className="heading"><Download /><h2>Phiên bản & cập nhật</h2><span>UPDATE CENTER</span></div>
        <div className="version-overview">
          <div className="version-current">
            <small>PHIÊN BẢN ĐANG CÀI</small>
            <strong>v{APP_VERSION}</strong>
            <span><ShieldCheck /> Kênh {APP_CHANNEL.toUpperCase()}</span>
          </div>
          <div className="version-description">
            <b>Kiểm tra bản phát hành mới</b>
            <p>Mở trang Releases của dự án để xem phiên bản mới nhất, ghi chú thay đổi và tải APK chính thức. Repository đang ở chế độ riêng tư nên cần đăng nhập GitHub có quyền truy cập.</p>
            <a className="support-action primary-action" href={APP_RELEASES_URL} target="_blank" rel="noreferrer">
              <ExternalLink /> Mở kênh cập nhật GitHub
            </a>
          </div>
        </div>
        <div className="update-steps">
          <b>Quy trình cập nhật Android</b>
          <ol>
            <li>Sao lưu dự án và dữ liệu đo trong mục Tools trước khi cài bản mới.</li>
            <li>Tải APK trong GitHub Release, mở tệp và xác nhận cài đặt theo hướng dẫn Android.</li>
            <li>Giữ nguyên ứng dụng và dữ liệu khi Android cho phép cập nhật trực tiếp.</li>
          </ol>
          <p className="warning">Android không cho phép ứng dụng tự cài APK im lặng. Bản cập nhật phải được ký cùng chứng thư với ứng dụng đang cài. Bản debug CI cũ có thể cần gỡ và cài lại bản ký ổn định lần đầu; hãy xuất bản sao lưu trước.</p>
        </div>
        <div className="version-links">
          <a href={APP_RELEASES_URL} target="_blank" rel="noreferrer">Lịch sử phát hành <ExternalLink /></a>
          <a href="https://github.com/nhocktrung2019-ux/CHURCH-AUDIO-AI/actions" target="_blank" rel="noreferrer">Trạng thái build APK <ExternalLink /></a>
          <a href="https://github.com/nhocktrung2019-ux/CHURCH-AUDIO-AI/blob/main/docs/ANDROID_UPDATE.md" target="_blank" rel="noreferrer">Hướng dẫn cập nhật <ExternalLink /></a>
        </div>
      </article>

      <article className="panel support-panel">
        <div className="heading"><Headset /><h2>Hỗ trợ kỹ thuật</h2><span>TECH SUPPORT</span></div>
        <p className="support-intro">Tạo báo cáo môi trường chạy để đội kỹ thuật xác định lỗi nhanh hơn. Báo cáo chỉ lấy thông tin nền tảng, API âm thanh và số lượng thiết bị; không ghi âm và không lấy tên hoặc mã thiết bị.</p>
        <div className="support-diagnostic-grid">
          <div><Activity /><b>Chẩn đoán hệ thống</b><small>Kiểm tra Web Audio, quyền truy cập API và trạng thái kết nối.</small></div>
          <div><FileCheck2 /><b>Báo cáo lỗi</b><small>Sao chép hoặc tải tệp TXT để đính kèm vào yêu cầu hỗ trợ.</small></div>
          <div><Wrench /><b>Hỗ trợ thiết bị</b><small>Ghi nhận Android, trình duyệt/WebView và khả năng nhận input/output.</small></div>
        </div>
        <div className="support-actions">
          <button disabled={busy} onClick={() => void handleCopy()}><ClipboardCopy /> {busy ? "Đang kiểm tra..." : "Tạo & sao chép báo cáo"}</button>
          <button className="secondary" disabled={busy} onClick={() => void handleDownload()}><Download /> Tải báo cáo TXT</button>
          <a className="support-action" href={APP_SUPPORT_URL} target="_blank" rel="noreferrer"><Headset /> Gửi yêu cầu hỗ trợ</a>
        </div>
        {notice && <p className="support-notice" role="status">{notice}</p>}
        {report && <details className="diagnostic-preview"><summary>Xem trước báo cáo chẩn đoán</summary><pre>{report}</pre></details>}
        <p className="muted">Không gửi mật khẩu, token, dữ liệu khách hàng hoặc bản ghi âm lên GitHub Issues. Chỉ đính kèm báo cáo sau khi đã xem và đồng ý chia sẻ.</p>
        <div className="version-links">
          <a href={APP_SUPPORT_DOCS_URL} target="_blank" rel="noreferrer">Hướng dẫn xử lý sự cố <ExternalLink /></a>
          <a href="https://github.com/nhocktrung2019-ux/CHURCH-AUDIO-AI/issues" target="_blank" rel="noreferrer">Theo dõi yêu cầu hỗ trợ <ExternalLink /></a>
        </div>
      </article>
    </section>
  );
}
