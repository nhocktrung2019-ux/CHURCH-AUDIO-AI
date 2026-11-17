import { useMemo, useState } from "react";
import { Download, Network, ShieldCheck, ClipboardCheck } from "lucide-react";
import { dspProfiles } from "../data/dspProfiles";
import { assessMeasurementReadiness, type MeasurementEvidence } from "./measurementReadiness";
const initialEvidence: MeasurementEvidence = {
  knownInputChain: false, measurementMicCalibrated: false, acousticCalibratorVerified: false,
  dualChannelLoopback: false, sharedHardwareClock: false, latencyCharacterized: false,
  perInputCalibration: false, multiSourceSynchronous: false, manufacturerPolarDataVerified: false,
};
function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DSPIntegrationPanel() {
  const [profileId, setProfileId] = useState(dspProfiles[0].id);
  const [systemName, setSystemName] = useState("");
  const [channelMap, setChannelMap] = useState("Mic 1 → Main L/R");
  const [hpfHz, setHpfHz] = useState(100);
  const [delayMs, setDelayMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<MeasurementEvidence>(initialEvidence);
  const profile = dspProfiles.find((item) => item.id === profileId) ?? dspProfiles[0];
  const readiness = useMemo(() => assessMeasurementReadiness(evidence), [evidence]);
  const exportWorksheet = () => downloadJson("church-audio-dsp-worksheet.json", {
    schema: "church-audio-dsp-worksheet/v1", exportedAt: new Date().toISOString(),
    systemName: systemName.trim() || "Chưa đặt tên hệ thống", device: profile,
    proposedSettings: { channelMap, highPassFilterHz: hpfHz, relativeDelayMs: delayMs, technicianNotes: notes },
    measurementReadiness: readiness,
    safety: { directHardwareControl: false, applyMode: "manual-review-required", warning: "Đây là phiếu cấu hình tham khảo; chưa kết nối hoặc ghi tham số vào DSP/mixer." },
  });
  const toggleEvidence = (key: keyof MeasurementEvidence, checked: boolean) => setEvidence((current) => ({ ...current, [key]: checked }));
  const evidenceFields: { key: keyof MeasurementEvidence; label: string }[] = [
    { key: "knownInputChain", label: "Đã xác minh toàn bộ chuỗi input, gain và routing" },
    { key: "measurementMicCalibrated", label: "Microphone đo có correction/calibration phù hợp" },
    { key: "acousticCalibratorVerified", label: "Đã kiểm tra offset SPL bằng acoustic calibrator" },
    { key: "dualChannelLoopback", label: "Có reference/loopback điện riêng biệt" },
    { key: "sharedHardwareClock", label: "Các kênh đo dùng chung hardware clock" },
    { key: "latencyCharacterized", label: "Đã đo và hiệu chỉnh latency của chuỗi đo" },
    { key: "perInputCalibration", label: "Mỗi microphone/input đã được hiệu chuẩn độc lập" },
    { key: "multiSourceSynchronous", label: "Đã xác nhận đồng bộ sample-accurate đa nguồn" },
    { key: "manufacturerPolarDataVerified", label: "Polar/beamwidth đúng model và cấu hình đã được xác minh" },
  ];
  return <section className="tab-stack dsp-integration-workspace">
    <article className="panel">
      <div className="heading"><Network /><h2>DSP & Mixer Integration · Thư viện thiết bị</h2><span>MANUAL WORKSHEET</span></div>
      <p className="muted">Quản lý cấu hình dự kiến cho mixer/DSP. Tất cả adapter hiện ở chế độ thủ công; ứng dụng chưa kết nối mạng hoặc ghi tham số vào phần cứng.</p>
      <div className="form-grid">
        <div><label htmlFor="dsp-profile">THIẾT BỊ</label><select id="dsp-profile" value={profileId} onChange={(event) => setProfileId(event.target.value)}>{dspProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label htmlFor="dsp-system-name">TÊN HỆ THỐNG / NHÀ THỜ</label><input id="dsp-system-name" value={systemName} onChange={(event) => setSystemName(event.target.value)} placeholder="Ví dụ: Main Hall" /></div>
        <div><label htmlFor="dsp-channel-map">CHANNEL / BUS MAPPING</label><input id="dsp-channel-map" value={channelMap} onChange={(event) => setChannelMap(event.target.value)} /></div>
        <div><label htmlFor="dsp-hpf">HPF ĐỀ XUẤT (Hz)</label><input id="dsp-hpf" type="number" min="20" max="1000" step="1" value={hpfHz} onChange={(event) => setHpfHz(Math.max(20, Math.min(1000, Number(event.target.value) || 20)))} /></div>
        <div><label htmlFor="dsp-delay">DELAY TƯƠNG ĐỐI ĐỀ XUẤT (ms)</label><input id="dsp-delay" type="number" min="0" max="500" step="0.01" value={delayMs} onChange={(event) => setDelayMs(Math.max(0, Math.min(500, Number(event.target.value) || 0)))} /></div>
        <div><label htmlFor="dsp-notes">GHI CHÚ KỸ THUẬT</label><input id="dsp-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Điều kiện đo, vị trí, preset..." /></div>
      </div>
      <div className="dsp-device-summary"><div><small>NHÓM THIẾT BỊ</small><b>{profile.family}</b></div><div><small>TRẠNG THÁI ĐIỀU KHIỂN</small><b>Chỉ phiếu thủ công</b></div></div>
      <p className="device-notice">{profile.integrationNote}</p><p className="warning">{profile.validationNeeded}</p>
      <button onClick={exportWorksheet}><Download /> Xuất phiếu cấu hình JSON</button>
      <p className="muted">Kỹ thuật viên phải kiểm tra đúng model, firmware, routing, limiter và mức đầu ra trước khi nhập thông số. Không áp dụng trực tiếp các giá trị đề xuất trong buổi lễ đang diễn ra.</p>
    </article>
    <article className="panel">
      <div className="heading"><ClipboardCheck /><h2>Measurement Readiness · Kiểm định chuỗi đo</h2><span>OPERATOR CHECKLIST</span></div>
      <p className="muted">Đánh dấu chỉ khi đã xác minh bằng thiết bị/thử nghiệm thực tế. Đây là checklist do kỹ thuật viên khai báo, không phải chức năng tự chứng nhận hay đo tự động.</p>
      <div className="measurement-evidence-list">{evidenceFields.map((field) => <label key={field.key}><input type="checkbox" checked={evidence[field.key]} onChange={(event) => toggleEvidence(field.key, event.target.checked)} /><span>{field.label}</span></label>)}</div>
      <div className="readiness-grid">{readiness.map((item) => <article key={item.id} className={item.state === "ready" ? "readiness-item ready" : "readiness-item limited"}><div><b>{item.title}</b><span>{item.state === "ready" ? "ĐỦ ĐIỀU KIỆN THEO CHECKLIST" : "CÒN GIỚI HẠN"}</span></div><p>{item.explanation}</p></article>)}</div>
      <button className="secondary" onClick={() => setEvidence(initialEvidence)}><ShieldCheck /> Đặt lại checklist</button>
    </article>
  </section>;
}
