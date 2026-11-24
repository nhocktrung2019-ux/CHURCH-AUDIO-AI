import { useEffect, useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { analyzeAcousticSnapshot } from "./acousticDiagnostics";
import { rtaBandFrequency } from "./rtaFrequency";
import { usePersistentState } from "./usePersistentState";
import type { ImpulseResponseResult } from "./rt60";
import type { TransferResult } from "./transfer";

type Props = { spectrumDbfs: number[]; running: boolean };

export default function AcousticDiagnosticsPanel({ spectrumDbfs, running }: Props) {
  const [rt60Result, setRt60Result] = usePersistentState<ImpulseResponseResult | null>("church-audio-rt60-latest", null);
  const [transferResult, setTransferResult] = usePersistentState<TransferResult | null>("church-audio-transfer-latest", null);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: unknown }>).detail;
      if (detail?.key === "church-audio-rt60-latest") setRt60Result((detail.value ?? null) as ImpulseResponseResult | null);
      if (detail?.key === "church-audio-transfer-latest") setTransferResult((detail.value ?? null) as TransferResult | null);
    };
    window.addEventListener("church-audio-measurement-updated", refresh);
    return () => window.removeEventListener("church-audio-measurement-updated", refresh);
  }, [setRt60Result, setTransferResult]);

  const report = useMemo(() => analyzeAcousticSnapshot({
    spectrum: running ? spectrumDbfs.map((levelDb, index) => ({
      frequencyHz: rtaBandFrequency(index, spectrumDbfs.length || 64),
      levelDb,
      evidence: "measured" as const,
    })).filter((bin) => bin.levelDb > -99) : [],
    rt60Bands: rt60Result?.bands.map((band) => ({
      centerHz: band.centerHz,
      rt20Seconds: band.rt20Seconds,
      rt30Seconds: band.rt30Seconds,
      rt60Seconds: band.rt60Seconds,
      fitR2: band.fitR2,
    })),
    transferPoints: transferResult?.points.map((point) => ({
      frequencyHz: point.frequencyHz,
      magnitudeDb: point.magnitudeDb,
      coherence: point.coherence,
    })),
    capture: transferResult?.captureQuality ? {
      sampleRate: transferResult.sampleRate,
      rmsDbfs: transferResult.captureQuality.rmsDbfs,
      peakDbfs: transferResult.captureQuality.peakDbfs,
      clippedSamplePercent: transferResult.captureQuality.clippedSamplePercent,
      invalidSamplePercent: transferResult.captureQuality.invalidSamplePercent,
      calibratedSpl: false,
    } : undefined,
  }), [spectrumDbfs, running, rt60Result, transferResult]);

  const transferMode = transferResult?.analysisMode ?? transferResult?.captureMetadata?.analysisMode ?? "mono-acoustic";
  const hasRt60 = Boolean(rt60Result?.bands.some((band) => band.rt60Seconds !== null));
  const hasTransfer = Boolean(transferResult?.points.length);
  return <section className="panel acoustic-diagnostics-panel">
    <div className="heading"><ClipboardList /><h2>Acoustic Intelligence · Báo cáo tổng hợp</h2><span>{report.status.toUpperCase()}</span></div>
    <p className="muted">Báo cáo đọc kết quả mới nhất từ các phân hệ RTA, RT60 và Transfer Function. Đây là các kết quả lưu riêng; chỉ xem là một phiên đo đồng nhất khi kỹ thuật viên xác nhận cùng cấu hình, vị trí và chuỗi thiết bị.</p>
    <div className="metrics">
      <article><small>RTA BINS LIVE</small><strong>{report.measuredBinCount} / {spectrumDbfs.length || 64}</strong></article>
      <article><small>RT60 OCTAVE BANDS</small><strong>{report.rt60.validBandCount} / 6</strong></article>
      <article><small>TRANSFER COHERENCE</small><strong>{report.transfer.averageCoherence === null ? "—" : (report.transfer.averageCoherence * 100).toFixed(0) + "%"}</strong></article>
      <article><small>SPL ABSOLUTE</small><strong>{report.splStatus === "calibrated" ? "CALIBRATED" : "NOT VERIFIED"}</strong></article>
    </div>
    <div className="form-grid">
      <article className="device-notice"><b>RT60</b><span>{hasRt60 ? `Đã lưu kết quả · RT60 trung vị ${report.rt60.medianSeconds?.toFixed(2) ?? "—"} s · độ rộng ${report.rt60.spreadSeconds?.toFixed(2) ?? "—"} s` : "Chưa có phép đo RT60 hợp lệ được lưu."}</span></article>
      <article className="device-notice"><b>Transfer / Phase</b><span>{hasTransfer ? `${transferResult?.points.length ?? 0} điểm · coherence tin cậy ${report.transfer.reliableBandPercent?.toFixed(0) ?? "—"}% · ${transferMode}` : "Chưa có kết quả Transfer Function được lưu."}</span></article>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Dải tần</th><th>Khoảng</th><th>Số bin</th><th>Mức năng lượng tương đối</th></tr></thead>
      <tbody>{report.spectrumBands.map((band) => <tr key={band.name}><td>{band.name}</td><td>{band.lowHz}–{band.highHz >= 1000 ? (band.highHz / 1000) + " kHz" : band.highHz + " Hz"}</td><td>{band.binCount}</td><td>{band.energyAverageDb === null ? "—" : band.energyAverageDb.toFixed(1) + " dBFS"}</td></tr>)}</tbody>
    </table></div>
    <div className="diagnostic-findings">
      {report.findings.length ? report.findings.map((item) => <article className={item.severity === "critical" ? "diagnostic-item critical" : item.severity === "warning" ? "diagnostic-item warning" : "diagnostic-item"} key={item.code}>
        <div>{item.severity === "critical" || item.severity === "warning" ? <AlertTriangle /> : <Activity />}</div>
        <section><b>{item.title}</b><p>{item.detail}</p><small>Đề xuất: {item.action}</small></section>
      </article>) : <p><CheckCircle2 /> Chưa phát hiện cảnh báo từ dữ liệu hiện có.</p>}
    </div>
    <p className="warning">Không tự động đồng bộ thời điểm giữa RTA, RT60 và Transfer. Transfer mono-acoustic không phải phép đo pha tuyệt đối; chế độ hai kênh vẫn cần hiệu chuẩn latency/skew phần cứng. RTA hiện là dBFS tương đối, không phải dB SPL. Không dùng báo cáo này làm chứng nhận nghiệm thu khi chưa đo kiểm bằng chuỗi đã hiệu chuẩn.</p>
  </section>;
}
