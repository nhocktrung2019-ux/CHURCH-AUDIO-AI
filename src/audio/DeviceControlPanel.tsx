import { useMemo, useState } from "react";
import { Cable, Copy, Download, ShieldAlert, SlidersHorizontal, Wifi } from "lucide-react";

type Target = "x32" | "m32" | "cd48" | "dbx" | "soundcraft";
const targets: { id: Target; label: string; protocol: string; port: number; readiness: string; note: string }[] = [
  { id: "x32", label: "Behringer X32 family", protocol: "OSC over UDP", port: 10023, readiness: "Protocol profile available", note: "X32, Compact, Producer, Rack và Core dùng OSC. Mạng LAN; UDP port 10023." },
  { id: "m32", label: "Midas M32 family", protocol: "OSC over UDP", port: 10023, readiness: "Protocol profile available", note: "M32/M32R/M32C dùng cùng họ giao thức OSC với X32." },
  { id: "cd48", label: "dBacoustics CD48", protocol: "Needs model protocol verification", port: 0, readiness: "Awaiting manufacturer protocol", note: "Chưa gửi lệnh điều khiển vì cần xác minh đúng phiên bản firmware, cổng kết nối và tài liệu protocol CD48." },
  { id: "dbx", label: "dbx processor", protocol: "Model-specific", port: 0, readiness: "Select exact model", note: "DriveRack PA2, VENU360, 260 và ZonePRO có phần mềm/giao thức khác nhau; không dùng chung lệnh." },
  { id: "soundcraft", label: "Soundcraft mixer", protocol: "Model-specific", port: 0, readiness: "Select exact model", note: "Ui, Si, Vi và dòng khác nhau có khả năng điều khiển khác nhau. Cần model cụ thể trước khi bật lệnh." },
];

export default function DeviceControlPanel() {
  const [target, setTarget] = useState<Target>("x32");
  const [model, setModel] = useState("");
  const [host, setHost] = useState("192.168.1.100");
  const [port, setPort] = useState("10023");
  const [channel, setChannel] = useState("01");
  const [gain, setGain] = useState("0");
  const [mute, setMute] = useState(false);
  const selected = targets.find(item => item.id === target)!;
  const supported = target === "x32" || target === "m32";
  const osc = useMemo(() => [
    { action: "Read channel gain", address: `/ch/${channel}/preamp/trim`, value: "query" },
    { action: "Set channel mute", address: `/ch/${channel}/mix/on`, value: mute ? 0 : 1 },
    { action: "Set channel gain", address: `/ch/${channel}/preamp/trim`, value: Number(gain) },
    { action: "Subscribe to console updates", address: "/xremote", value: null },
  ], [channel, gain, mute]);
  const config = {
    schema: "church-audio-device-profile/v1",
    generatedAt: new Date().toISOString(),
    target: selected.label,
    model: model || selected.label,
    connection: { transport: supported ? "OSC-UDP" : "unverified", host, port: Number(port) || null },
    protocolStatus: supported ? "protocol-profile-only-no-live-transport" : "manufacturer-protocol-not-verified",
    safety: "No command has been sent. Review channel mapping and current mixer state before enabling any future live write.",
    oscPreview: supported ? osc : [],
  };
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-device-profile.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyAddress = async (address: string) => {
    try { await navigator.clipboard.writeText(address); } catch { /* Clipboard may be unavailable in embedded Android WebView. */ }
  };
  return <article className="panel device-control-panel">
    <div className="heading"><Cable /><h2>DSP & Mixer Control</h2><span>DEVICE PROFILES</span></div>
    <p className="muted">Thiết lập hồ sơ kết nối thiết bị âm thanh. Giao diện này chưa gửi lệnh mạng hoặc thay đổi thông số trên mixer/DSP.</p>
    <div className="device-control-grid">
      <div className="protection-field full"><label>THIẾT BỊ / HỌ SẢN PHẨM</label><select value={target} onChange={event => { const next = event.target.value as Target; setTarget(next); const item = targets.find(x => x.id === next)!; setPort(String(item.port || "")); }}><option value="x32">Behringer X32</option><option value="m32">Midas M32</option><option value="cd48">dBacoustics CD48</option><option value="dbx">dbx DriveRack / ZonePRO</option><option value="soundcraft">Soundcraft</option></select></div>
      <div className="protection-field"><label>MODEL / FIRMWARE</label><input value={model} onChange={event => setModel(event.target.value)} placeholder={target === "dbx" ? "VD: DriveRack VENU360" : target === "soundcraft" ? "VD: Ui24R / Si Expression" : "Nhập phiên bản nếu biết"} /></div>
      <div className="protection-field"><label>ĐỊA CHỈ IP LAN</label><input value={host} onChange={event => setHost(event.target.value)} placeholder="192.168.1.100" /></div>
      <div className="protection-field"><label>UDP PORT</label><input value={port} onChange={event => setPort(event.target.value)} inputMode="numeric" placeholder="10023" /></div>
      {supported && <>
        <div className="protection-field"><label>INPUT CHANNEL (01–32)</label><input value={channel} onChange={event => setChannel(event.target.value.replace(/\D/g, "").slice(0, 2).padStart(2, "0"))} inputMode="numeric" /></div>
        <div className="protection-field"><label>PREAMP TRIM PREVIEW (dB)</label><input value={gain} onChange={event => setGain(event.target.value)} inputMode="decimal" /></div>
        <label className="device-mute-toggle"><input type="checkbox" checked={mute} onChange={event => setMute(event.target.checked)} /> Preview trạng thái mute ON</label>
      </>}
    </div>
    <div className={supported ? "device-protocol-status" : "device-protocol-status pending"}>
      {supported ? <Wifi /> : <ShieldAlert />}
      <div><b>{selected.readiness}</b><span>{selected.note}</span></div>
    </div>
    {supported && <section className="osc-preview">
      <div className="protection-subheading"><SlidersHorizontal /><b>OSC COMMAND PREVIEW</b><span>NOT SENT</span></div>
      {osc.map(item => <div className="osc-line" key={item.action}><div><b>{item.action}</b><code>{item.address}</code><small>Value: {item.value === null ? "subscribe" : String(item.value)}</small></div><button type="button" className="icon-button" aria-label="Copy OSC address" onClick={() => void copyAddress(item.address)}><Copy /></button></div>)}
      <p className="muted">X32/M32 OSC qua Ethernet UDP port 10023. Đây mới là bản xem trước địa chỉ và giá trị; ứng dụng chưa có UDP socket/native bridge nên chưa thể kết nối, đọc trạng thái hoặc ghi thông số mixer.</p>
    </section>}
    <div className="protection-actions"><button type="button" onClick={exportConfig}><Download /> Xuất hồ sơ thiết bị JSON</button></div>
    <p className="warning protection-warning"><ShieldAlert /> Không dùng profile này để điều khiển trực tiếp hệ thống đang phát lễ. Cần hoàn thiện native network transport, xác thực phản hồi, đọc giá trị hiện tại, xác nhận thao tác và thử nghiệm trên thiết bị thật trước khi bật ghi thông số.</p>
  </article>;
}
