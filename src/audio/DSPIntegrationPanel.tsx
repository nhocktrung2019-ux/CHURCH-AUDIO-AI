import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { assessCD48NetworkConfig, type CD48HardwareRevision, type CD48NetworkLink } from "./cd48Network";
import { Download, Network, ShieldCheck, ClipboardCheck, ExternalLink } from "lucide-react";
import { dspProfiles } from "../data/dspProfiles";
import CD48PresetEditor from "./CD48PresetEditor";
import DSPDynamicsAdvisor from "./DSPDynamicsAdvisor";
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
  const [modelName, setModelName] = useState(dspProfiles[0].models[0] ?? "");
  const [systemName, setSystemName] = useState("");
  const [channelMap, setChannelMap] = useState("Mic 1 → Main L/R");
  const [hpfHz, setHpfHz] = useState(100);
  const [delayMs, setDelayMs] = useState(0);
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<MeasurementEvidence>(initialEvidence);
  const [cd48Revision, setCd48Revision] = usePersistentState<CD48HardwareRevision>("church-audio-cd48-hardware-revision", "cd48-100m-rj45-observed");
  const [cd48Link, setCd48Link] = usePersistentState<CD48NetworkLink>("church-audio-cd48-network-link", "ethernet");
  const [cd48DeviceIp, setCd48DeviceIp] = usePersistentState("church-audio-cd48-device-ip", "192.168.20.20");
  const [cd48ControllerIp, setCd48ControllerIp] = usePersistentState("church-audio-cd48-controller-ip", "");
  const [cd48SubnetPrefix, setCd48SubnetPrefix] = usePersistentState("church-audio-cd48-subnet-prefix", 24);
  const cd48Network = useMemo(() => assessCD48NetworkConfig({
    hardwareRevision: cd48Revision, link: cd48Link, deviceIp: cd48DeviceIp,
    controllerIp: cd48ControllerIp, subnetPrefix: cd48SubnetPrefix,
  }), [cd48Revision, cd48Link, cd48DeviceIp, cd48ControllerIp, cd48SubnetPrefix]);
  const profile = dspProfiles.find((item) => item.id === profileId) ?? dspProfiles[0];
  const readiness = useMemo(() => assessMeasurementReadiness(evidence), [evidence]);
  const exportWorksheet = () => downloadJson("church-audio-dsp-worksheet.json", {
    schema: "church-audio-dsp-worksheet/v1", exportedAt: new Date().toISOString(),
    systemName: systemName.trim() || "Chưa đặt tên hệ thống", device: profile, selectedModel: modelName,
    proposedSettings: {
      channelMap, highPassFilterHz: hpfHz, relativeDelayMs: delayMs, technicianNotes: notes,
      ...(profile.id === "db-acoustics-cd48" ? {
        cd48Network: {
          hardwareRevision: cd48Revision, link: cd48Link, deviceIp: cd48DeviceIp,
          controllerIp: cd48ControllerIp, subnetPrefix: cd48SubnetPrefix,
          assessment: cd48Network,
          liveControl: false,
        },
      } : {}),
    },
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
        <div><label htmlFor="dsp-profile">HÃNG / NHÓM THIẾT BỊ</label><select id="dsp-profile" value={profileId} onChange={(event) => { const next = dspProfiles.find((item) => item.id === event.target.value) ?? dspProfiles[0]; setProfileId(next.id); setModelName(next.models[0] ?? ""); }}>{dspProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label htmlFor="dsp-model">MODEL CỤ THỂ</label><select id="dsp-model" value={modelName} onChange={(event) => setModelName(event.target.value)}>{profile.models.map((model) => <option key={model} value={model}>{model}</option>)}</select></div>
        <div><label htmlFor="dsp-system-name">TÊN HỆ THỐNG / NHÀ THỜ</label><input id="dsp-system-name" value={systemName} onChange={(event) => setSystemName(event.target.value)} placeholder="Ví dụ: Main Hall" /></div>
        <div><label htmlFor="dsp-channel-map">CHANNEL / BUS MAPPING</label><input id="dsp-channel-map" value={channelMap} onChange={(event) => setChannelMap(event.target.value)} /></div>
        <div><label htmlFor="dsp-hpf">HPF ĐỀ XUẤT (Hz)</label><input id="dsp-hpf" type="number" min="20" max="1000" step="1" value={hpfHz} onChange={(event) => setHpfHz(Math.max(20, Math.min(1000, Number(event.target.value) || 20)))} /></div>
        <div><label htmlFor="dsp-delay">DELAY TƯƠNG ĐỐI ĐỀ XUẤT (ms)</label><input id="dsp-delay" type="number" min="0" max="500" step="0.01" value={delayMs} onChange={(event) => setDelayMs(Math.max(0, Math.min(500, Number(event.target.value) || 0)))} /></div>
        <div><label htmlFor="dsp-notes">GHI CHÚ KỸ THUẬT</label><input id="dsp-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Điều kiện đo, vị trí, preset..." /></div>
      </div>
      <div className="dsp-device-summary">
        <div><small>NHÓM THIẾT BỊ</small><b>{profile.family}</b></div>
        <div><small>MODEL ĐANG CHỌN</small><b>{modelName || "Chưa chọn model"}</b></div>
        <div><small>ĐƯỜNG KẾT NỐI ĐƯỢC TÀI LIỆU HÓA</small><b>{profile.transport}</b></div>
        <div><small>TRẠNG THÁI ĐIỀU KHIỂN</small><b>Chỉ phiếu thủ công · Chưa ghi phần cứng</b></div>
      </div>
      <p className="device-notice">{profile.integrationNote}</p>
      {profile.id === "db-acoustics-cd48" && <article className="panel cd48-network-panel">
        <div className="heading"><Network /><h3>CD48 · Ethernet / Wi-Fi LAN</h3><span>NETWORK SETUP</span></div>
        <p className="muted">Ảnh tham chiếu bạn gửi cho thấy RJ45 ghi 100M Ethernet và LCD hiển thị IP 192.168.20.20 / Ver 2215. IP được điền sẵn theo ảnh; hãy đối chiếu màn hình của thiết bị thực tế vì địa chỉ có thể đã được đổi.</p>
        <div className="form-grid">
          <div>
            <label htmlFor="cd48-hardware-revision">PHIÊN BẢN / CỔNG VẬT LÝ</label>
            <select id="cd48-hardware-revision" value={cd48Revision} onChange={(event) => setCd48Revision(event.target.value as CD48HardwareRevision)}>
              <option value="cd48-100m-rj45-observed">CD48 theo ảnh gửi · RJ45 100M Ethernet · Ver 2215</option>
              <option value="unverified">Chưa xác minh mặt sau thiết bị thực tế</option>
              <option value="standard-usb-rs232">Phiên bản chỉ có USB + RS232</option>
              <option value="rj45-confirmed">Phiên bản khác có RJ45 · đã xác nhận trực tiếp</option>
            </select>
          </div>
          <div>
            <label htmlFor="cd48-link-type">ĐƯỜNG MẠNG ĐIỀU KHIỂN</label>
            <select id="cd48-link-type" value={cd48Link} onChange={(event) => setCd48Link(event.target.value as CD48NetworkLink)}>
              <option value="ethernet">Ethernet · Android qua LAN/USB-C Ethernet</option>
              <option value="wifi-lan">Wi-Fi LAN · Android qua Wi-Fi router</option>
            </select>
          </div>
          <div><label htmlFor="cd48-device-ip">IP CỦA CD48 · THEO ẢNH: 192.168.20.20</label><input id="cd48-device-ip" value={cd48DeviceIp} onChange={(event) => setCd48DeviceIp(event.target.value)} placeholder="Đọc IP trên màn hình LCD CD48" inputMode="decimal" /></div>
          <div><label htmlFor="cd48-controller-ip">IP ĐIỆN THOẠI / THIẾT BỊ ĐIỀU KHIỂN</label><input id="cd48-controller-ip" value={cd48ControllerIp} onChange={(event) => setCd48ControllerIp(event.target.value)} placeholder="Xem trong chi tiết Wi-Fi/LAN Android" inputMode="decimal" /></div>
          <div><label htmlFor="cd48-subnet-prefix">SUBNET PREFIX</label><select id="cd48-subnet-prefix" value={String(cd48SubnetPrefix)} onChange={(event) => setCd48SubnetPrefix(Number(event.target.value))}>
            {[24, 23, 22, 16, 25, 26, 27, 28, 29, 30].map((value) => <option key={value} value={value}>/{value}</option>)}
          </select></div>
        </div>
        <div className={cd48Network.mayUseLanPath ? "readiness-item limited" : "readiness-item limited"}>
          <b>{cd48Network.mayUseLanPath ? "Cấu hình IP cùng subnet" : "Chưa sẵn sàng cho LAN"}</b>
          <p>{cd48Network.message}</p>
        </div>
        <div className="permission-help">
          <b>Sơ đồ Wi-Fi LAN</b>
          <span>CD48 (RJ45) → dây Ethernet → router/switch. Điện thoại → Wi-Fi của chính router đó. Tắt Guest Wi-Fi/AP isolation; kiểm tra hai IP và subnet giống nhau. Với chế độ Ethernet, điện thoại phải nối vào cùng LAN qua cổng Ethernet hoặc adapter USB-C LAN.</span>
        </div>
        <p className="warning">Chưa có tài liệu giao thức mạng/port điều khiển công khai được xác minh cho CD48 trong dự án. Trạng thái cùng subnet không đồng nghĩa DSP đã online. Ứng dụng hiện chỉ kiểm tra IP nhập tay; chưa ping, dò thiết bị hay gửi lệnh. Không tự dùng IP mặc định/port của PH48D cho CD48.</p>
      </article>}
      {profile.id === "db-acoustics-cd48" && <CD48PresetEditor />}
      <p className="muted">Mức bằng chứng: {profile.evidenceGrade === "manufacturer-documentation" ? "Tài liệu hãng/nhà sản xuất" : profile.evidenceGrade === "community-protocol-reference" ? "Tài liệu giao thức cộng đồng, chưa phải xác nhận của hãng" : "Ảnh thiết bị do người dùng cung cấp; chưa xác minh kết nối thực tế"}</p>
      <p className="warning">{profile.validationNeeded}</p>
      <a className="support-action" href={profile.documentationUrl} target="_blank" rel="noreferrer"><ExternalLink /> Tài liệu tham chiếu cho model đã chọn</a>
      <button onClick={exportWorksheet}><Download /> Xuất phiếu cấu hình JSON</button>
      <p className="muted">Kỹ thuật viên phải kiểm tra đúng model, firmware, routing, limiter và mức đầu ra trước khi nhập thông số. Không áp dụng trực tiếp các giá trị đề xuất trong buổi lễ đang diễn ra.</p>
    </article>
    <DSPDynamicsAdvisor />
    <article className="panel">
      <div className="heading"><ClipboardCheck /><h2>Measurement Readiness · Kiểm định chuỗi đo</h2><span>OPERATOR CHECKLIST</span></div>
      <p className="muted">Đánh dấu chỉ khi đã xác minh bằng thiết bị/thử nghiệm thực tế. Đây là checklist do kỹ thuật viên khai báo, không phải chức năng tự chứng nhận hay đo tự động.</p>
      <div className="measurement-evidence-list">{evidenceFields.map((field) => <label key={field.key}><input type="checkbox" checked={evidence[field.key]} onChange={(event) => toggleEvidence(field.key, event.target.checked)} /><span>{field.label}</span></label>)}</div>
      <div className="readiness-grid">{readiness.map((item) => <article key={item.id} className={item.state === "ready" ? "readiness-item ready" : "readiness-item limited"}><div><b>{item.title}</b><span>{item.state === "ready" ? "ĐỦ ĐIỀU KIỆN THEO CHECKLIST" : "CÒN GIỚI HẠN"}</span></div><p>{item.explanation}</p></article>)}</div>
      <button className="secondary" onClick={() => setEvidence(initialEvidence)}><ShieldCheck /> Đặt lại checklist</button>
    </article>
  </section>;
}
