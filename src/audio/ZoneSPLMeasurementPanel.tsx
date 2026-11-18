import { useEffect, useRef, useState } from "react";
import { Activity, Download, Gauge, Trash2 } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { compareZoneLevels, energyAverageDb, summarizeUniformity, type ZoneSplRecord, type ZoneSplUnit } from "./zoneSplUniformity";

type Props = {
  running: boolean;
  liveAWeightedDbfs: number;
  offsetDb: number;
  calibrationProfileReady: boolean;
  inputLabel: string;
  zoneOptions: string[];
  selectedZoneName: string;
  onSelectedZoneChange: (zone: string) => void;
};

type CaptureMeta = {
  zone: string;
  position: string;
  durationSeconds: number;
  inputLabel: string;
  offsetDb: number;
  calibrated: boolean;
};

export default function ZoneSPLMeasurementPanel({
  running, liveAWeightedDbfs, offsetDb, calibrationProfileReady, inputLabel,
  zoneOptions, selectedZoneName, onSelectedZoneChange,
}: Props) {
  const [records, setRecords] = usePersistentState<ZoneSplRecord[]>("church-audio-zone-spl-records-v1", []);
  const [position, setPosition] = useState("Hàng ghế 1 · Giữa");
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [confirmCalibration, setConfirmCalibration] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [notice, setNotice] = useState("");
  const [uniformityLimitDb, setUniformityLimitDb] = useState(6);
  const [zoneBalanceToleranceDb, setZoneBalanceToleranceDb] = useState(2);
  const samplesRef = useRef<number[]>([]);
  const captureMetaRef = useRef<CaptureMeta | null>(null);
  const latestRef = useRef({ liveAWeightedDbfs, offsetDb });
  latestRef.current = { liveAWeightedDbfs, offsetDb };

  const currentUnit: ZoneSplUnit = calibrationProfileReady && confirmCalibration ? "dB SPL" : "dBFS";
  const validRecords = records.filter((record) => record.unit === currentUnit);
  const overall = summarizeUniformity(validRecords);
  const zoneBalance = compareZoneLevels(validRecords, zoneBalanceToleranceDb);
  const zoneNames = [...new Set(validRecords.map((record) => record.zone))].sort((a, b) => a.localeCompare(b, "vi"));
  const zoneSummaries = zoneNames.map((name) => ({
    zone: name,
    summary: summarizeUniformity(validRecords.filter((record) => record.zone === name)),
  }));

  useEffect(() => {
    if (!capturing) return;
    if (!running) {
      setCapturing(false);
      setNotice("Microphone đã dừng; phép đo chưa được lưu.");
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const latest = latestRef.current;
      if (Number.isFinite(latest.liveAWeightedDbfs) && latest.liveAWeightedDbfs > -99) {
        samplesRef.current.push(latest.liveAWeightedDbfs);
      }
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, durationSeconds - elapsed));
      if (elapsed < durationSeconds) return;

      window.clearInterval(timer);
      const rawDbfs = energyAverageDb(samplesRef.current);
      const meta = captureMetaRef.current;
      const samples = samplesRef.current.length;
      setCapturing(false);
      setRemaining(0);
      if (!meta || rawDbfs === null || samples < Math.max(5, durationSeconds * 3)) {
        setNotice("Không đủ mẫu hợp lệ. Kiểm tra micro và đo lại tại vị trí cố định.");
        return;
      }
      const levelDb = meta.calibrated ? rawDbfs + meta.offsetDb : rawDbfs;
      const record: ZoneSplRecord = {
        id: Date.now(),
        zone: meta.zone,
        position: meta.position,
        levelDb,
        rawDbfs,
        unit: meta.calibrated ? "dB SPL" : "dBFS",
        durationSeconds: meta.durationSeconds,
        sampleCount: samples,
        inputLabel: meta.inputLabel,
        timestamp: Date.now(),
        calibrationOffsetDb: meta.calibrated ? meta.offsetDb : undefined,
      };
      setRecords((previous) => [record, ...previous].slice(0, 500));
      setNotice(`Đã lưu ${record.zone} · ${record.position}: ${record.levelDb.toFixed(1)} ${record.unit}.`);
    }, 100);
    return () => window.clearInterval(timer);
  }, [capturing, running, durationSeconds, setRecords]);

  const startCapture = () => {
    if (!running || capturing) return;
    samplesRef.current = [];
    captureMetaRef.current = {
      zone: selectedZoneName.trim() || "Chưa đặt tên vùng",
      position: position.trim() || "Chưa đặt vị trí",
      durationSeconds,
      inputLabel,
      offsetDb,
      calibrated: calibrationProfileReady && confirmCalibration,
    };
    setNotice("Đang lấy mẫu. Giữ micro cố định và không thay đổi gain.");
    setRemaining(durationSeconds);
    setCapturing(true);
  };

  const exportCsv = () => {
    const header = ["timestamp_iso", "zone", "position", "level", "unit", "raw_a_weighted_dbfs", "duration_s", "sample_count", "input"];
    const rows = records.map((record) => [
      new Date(record.timestamp).toISOString(), record.zone, record.position,
      record.levelDb.toFixed(2), record.unit, record.rawDbfs.toFixed(2),
      record.durationSeconds, record.sampleCount, record.inputLabel,
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-zone-spl.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const removeRecord = (id: number) => setRecords((previous) => previous.filter((record) => record.id !== id));
  const fmt = (value: number | undefined) => value === undefined ? "—" : value.toFixed(1);

  return <section className="panel zone-spl-panel">
    <div className="heading"><Gauge/><h2>Đo SPL từng vùng · Độ đồng đều</h2><span>{capturing ? "CAPTURING" : running ? "MIC LIVE" : "MIC OFF"}</span></div>
    <p className="muted">Đo lần lượt từng vùng loa tại các vị trí nghe. Solo đúng zone trên mixer/DSP trước mỗi lần đo; giữ nguyên gain, vị trí micro và điều kiện phát trong toàn bộ lượt so sánh.</p>
    <div className="zone-spl-form">
      <label>KHU VỰC LOA{zoneOptions.length > 0 ? <select value={selectedZoneName} onChange={(event) => onSelectedZoneChange(event.target.value)} disabled={capturing}>{zoneOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select> : <input value={selectedZoneName} onChange={(event) => onSelectedZoneChange(event.target.value)} disabled={capturing} placeholder="Chọn vùng trong mô hình 3D"/>}</label>
      <label>VỊ TRÍ / HÀNG GHẾ<input value={position} onChange={(event) => setPosition(event.target.value)} disabled={capturing} placeholder="Ví dụ: Hàng ghế 3 · Trái"/></label>
      <label>THỜI GIAN ĐO<select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} disabled={capturing}><option value={5}>5 giây</option><option value={10}>10 giây</option><option value={15}>15 giây</option><option value={30}>30 giây</option></select></label>
    </div>
    <label className="zone-spl-confirm"><input type="checkbox" checked={confirmCalibration} disabled={!calibrationProfileReady || capturing} onChange={(event) => setConfirmCalibration(event.target.checked)}/><span>Tôi xác nhận microphone/input đang dùng đã có file hiệu chỉnh đáp tuyến phù hợp và offset đã được đặt bằng acoustic calibrator thực.</span></label>
    <div className="zone-spl-actions">
      <button onClick={startCapture} disabled={!running || capturing}><Activity/>{capturing ? `Đang đo · ${remaining.toFixed(1)} s` : "Bắt đầu đo vị trí"}</button>
      <button className="secondary" onClick={() => setCapturing(false)} disabled={!capturing}>Hủy lượt đo</button>
      <button className="secondary" onClick={exportCsv} disabled={!records.length}><Download/> Xuất CSV</button>
    </div>
    {capturing && <div className="zone-spl-progress"><i style={{width: `${Math.max(0, Math.min(100, (1 - remaining / durationSeconds) * 100))}%`}}/></div>}
    {notice && <p className="device-notice" role="status">{notice}</p>}
    <div className="zone-spl-stats">
      <article><small>ĐIỂM ĐO ({currentUnit})</small><b>{validRecords.length}</b></article>
      <article><small>TRUNG BÌNH</small><b>{fmt(overall?.meanDb)} <small>{currentUnit}</small></b></article>
      <article><small>MIN / MAX</small><b>{fmt(overall?.minDb)} / {fmt(overall?.maxDb)}</b></article>
      <article><small>ĐỘ TRẢI MAX–MIN</small><b>{fmt(overall?.spreadDb)} dB</b></article>
    </div>
    <div className="zone-spl-threshold"><label>NGƯỠNG ĐỘ TRẢI THAM KHẢO <b>{uniformityLimitDb} dB</b><input type="range" min="2" max="12" step="1" value={uniformityLimitDb} onChange={(event) => setUniformityLimitDb(Number(event.target.value))}/></label>
      {overall && <span className={overall.spreadDb <= uniformityLimitDb ? "uniformity-good" : "uniformity-warn"}>{overall.spreadDb <= uniformityLimitDb ? "Trong ngưỡng do người dùng đặt" : "Chênh lệch vượt ngưỡng · cần kiểm tra"}</span>}
    </div>
    <div className="zone-spl-threshold"><label>NGƯỠNG CÂN BẰNG GIỮA CÁC VÙNG <b>±{zoneBalanceToleranceDb} dB</b><input type="range" min="1" max="6" step="0.5" value={zoneBalanceToleranceDb} onChange={(event) => setZoneBalanceToleranceDb(Number(event.target.value))}/></label></div>
    {validRecords.length > 0 && !zoneBalance && <p className="warning">Không thể so sánh công bằng: dữ liệu có thể khác đầu vào microphone, đơn vị hoặc offset hiệu chuẩn. Hãy dùng cùng microphone, cùng đơn vị và cùng cấu hình hiệu chuẩn cho mọi vùng.</p>}
    {zoneBalance && <div className="table-wrap"><table><thead><tr><th>So sánh vùng</th><th>Vị trí</th><th>TB vùng</th><th>Lệch TB chung</th><th>Đánh giá</th></tr></thead><tbody>
      {zoneBalance.map((row) => <tr key={row.zone}><td>{row.zone}</td><td>{row.positionCount} / {row.pointCount} điểm</td><td>{row.meanDb.toFixed(1)} {currentUnit}</td><td>{row.deltaFromMeanDb > 0 ? "+" : ""}{row.deltaFromMeanDb.toFixed(1)} dB</td><td>{row.status === "balanced" ? "Cân bằng" : row.status === "low" ? "Thấp hơn" : row.status === "high" ? "Cao hơn" : "Cần đo thêm ≥2 vị trí"}</td></tr>)}
    </tbody></table><p className="muted">Mỗi vị trí nghe được tính trọng số như nhau; các lần đo lặp tại cùng vị trí được gộp theo trung bình năng lượng. Mốc tham chiếu là trung bình các vùng, không phải chuẩn âm học bắt buộc.</p></div>}
    <div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Điểm</th><th>Trung bình</th><th>Min–Max</th><th>Độ trải</th><th>σ</th></tr></thead><tbody>
      {zoneSummaries.map(({zone: zoneName, summary}) => summary && <tr key={zoneName}><td>{zoneName}</td><td>{summary.count}</td><td>{summary.meanDb.toFixed(1)} {summary.unit}</td><td>{summary.minDb.toFixed(1)}–{summary.maxDb.toFixed(1)}</td><td>{summary.spreadDb.toFixed(1)} dB</td><td>{summary.standardDeviationDb.toFixed(1)}</td></tr>)}
      {!zoneSummaries.length && <tr><td colSpan={6}>Chưa có điểm đo cùng đơn vị. Hãy chọn vùng, đặt micro tại vị trí ghế và bắt đầu đo.</td></tr>}
    </tbody></table></div>
    <div className="zone-spl-records">{records.slice(0, 30).map((record) => <article key={record.id}><div><b>{record.zone} · {record.position}</b><small>{new Date(record.timestamp).toLocaleString()} · {record.durationSeconds}s · {record.inputLabel || "Micro mặc định"}</small></div><strong>{record.levelDb.toFixed(1)} <small>{record.unit}</small></strong><button className="icon-button" aria-label="Xóa điểm đo" onClick={() => removeRecord(record.id)}><Trash2/></button></article>)}</div>
    {records.length > 30 && <p className="muted">Đang hiển thị 30 / {records.length} điểm gần nhất. CSV chứa toàn bộ dữ liệu.</p>}
    <p className="warning">Mức đo được lấy mẫu A-weighted từ luồng microphone mỗi 100 ms và tính trung bình năng lượng trong khoảng đo; đây là phép đo khảo sát của ứng dụng, chưa được xác nhận dung sai IEC 61672. Nếu chưa xác nhận hiệu chuẩn riêng cho đúng input, bản ghi được giữ ở dBFS, không gắn nhãn dB SPL. Không so sánh các bản ghi khác đơn vị.</p>
  </section>;
}
