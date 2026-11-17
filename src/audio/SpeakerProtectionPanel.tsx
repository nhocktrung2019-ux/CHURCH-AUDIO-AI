import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { ShieldCheck, RadioTower, Users, Download, Volume2, AlertTriangle } from "lucide-react";

type MicChannel = { id: string; name: string; open: boolean; gainTrimDb: number };
type SpeakerProfile = {
  model: string;
  continuousPowerW: number;
  nominalImpedanceOhm: number;
  amplifierGainDb: number;
  ampInputSensitivityVrms: number;
  safetyMarginDb: number;
};

const DEFAULT_SPEAKER: SpeakerProfile = {
  model: "Loa chính",
  continuousPowerW: 400,
  nominalImpedanceOhm: 8,
  amplifierGainDb: 32,
  ampInputSensitivityVrms: 1.4,
  safetyMarginDb: 3,
};

function numberValue(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function exportJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SpeakerProtectionPanel() {
  const [speaker, setSpeaker] = usePersistentState<SpeakerProfile>("church-audio-speaker-protection-profile", DEFAULT_SPEAKER);
  const [channels, setChannels] = usePersistentState<MicChannel[]>("church-audio-mic-channel-plan", [
    { id: "mic-1", name: "Micro giảng 1", open: true, gainTrimDb: 0 },
    { id: "mic-2", name: "Micro giảng 2", open: false, gainTrimDb: 0 },
    { id: "mic-3", name: "Micro bục", open: false, gainTrimDb: 0 },
    { id: "mic-4", name: "Micro ca đoàn", open: false, gainTrimDb: 0 },
  ]);
  const [notice, setNotice] = useState("");

  const calculation = useMemo(() => {
    const power = Math.max(1, speaker.continuousPowerW);
    const impedance = Math.max(1, speaker.nominalImpedanceOhm);
    const speakerVoltageVrms = Math.sqrt(power * impedance);
    const ampGain = Math.pow(10, speaker.amplifierGainDb / 20);
    const ampInputAtRatedPowerVrms = speakerVoltageVrms / ampGain;
    const targetInputVrms = ampInputAtRatedPowerVrms * Math.pow(10, -speaker.safetyMarginDb / 20);
    const thresholdDbu = 20 * Math.log10(targetInputVrms / 0.775);
    const sensitivityDbu = 20 * Math.log10(Math.max(0.01, speaker.ampInputSensitivityVrms) / 0.775);
    const openMics = channels.filter((channel) => channel.open).length;
    const theoreticalGainPenaltyDb = openMics > 1 ? 10 * Math.log10(openMics) : 0;
    return { speakerVoltageVrms, ampInputAtRatedPowerVrms, targetInputVrms, thresholdDbu, sensitivityDbu, openMics, theoreticalGainPenaltyDb };
  }, [speaker, channels]);

  const updateSpeaker = (key: keyof SpeakerProfile, value: string) => {
    if (key === "model") setSpeaker((current) => ({ ...current, model: value.slice(0, 80) }));
    else {
      const ranges: Record<Exclude<keyof SpeakerProfile, "model">, [number, number]> = {
        continuousPowerW: [10, 10000],
        nominalImpedanceOhm: [2, 32],
        amplifierGainDb: [0, 60],
        ampInputSensitivityVrms: [0.1, 10],
        safetyMarginDb: [1, 12],
      };
      const bounds = ranges[key];
      setSpeaker((current) => ({ ...current, [key]: numberValue(value, current[key] as number, bounds[0], bounds[1]) }));
    }
  };

  const updateChannel = (id: string, patch: Partial<MicChannel>) => {
    setChannels((current) => current.map((channel) => channel.id === id ? { ...channel, ...patch } : channel));
  };

  const addChannel = () => {
    if (channels.length >= 16) return;
    const next = channels.length + 1;
    setChannels((current) => [...current, { id: "mic-" + Date.now(), name: "Micro " + next, open: false, gainTrimDb: 0 }]);
  };

  const exportProfile = () => {
    exportJson("church-audio-speaker-protection.json", {
      format: "Church Audio Speaker Protection Advisory",
      version: 1,
      generatedAt: new Date().toISOString(),
      status: "calculated-advisory-not-applied",
      speaker,
      calculated: {
        maximumSpeakerVoltageVrms: Number(calculation.speakerVoltageVrms.toFixed(3)),
        amplifierInputAtRatedPowerVrms: Number(calculation.ampInputAtRatedPowerVrms.toFixed(3)),
        suggestedLimiterThresholdVrms: Number(calculation.targetInputVrms.toFixed(3)),
        suggestedLimiterThresholdDbu: Number(calculation.thresholdDbu.toFixed(2)),
        openMicrophoneCount: calculation.openMics,
        theoreticalOpenMicGainPenaltyDb: Number(calculation.theoreticalGainPenaltyDb.toFixed(2)),
      },
      microphones: channels,
      warning: "Do not upload directly to DSP without verifying amplifier gain, limiter detector reference, RMS/peak mode, speaker wiring and manufacturer ratings.",
    });
    setNotice("Đã xuất hồ sơ bảo vệ loa dạng JSON. Chưa ghi vào DSP.");
  };

  return (
    <section className="panel protection-panel">
      <div className="heading"><ShieldCheck /><h2>Speaker Protection & Multi-Mic Manager</h2><span>SAFE ADVISORY</span></div>
      <p className="muted">Tính ngưỡng limiter tham khảo từ công suất liên tục, trở kháng và gain ampli; quản lý số micro đang mở để giảm nguy cơ mất gain-before-feedback.</p>

      <div className="protection-subheading"><ShieldCheck /><b>Hồ sơ loa và ampli</b></div>
      <div className="form-grid">
        <div className="protection-field full"><label>TÊN / MODEL LOA</label><input value={speaker.model} maxLength={80} onChange={(event) => updateSpeaker("model", event.target.value)} /></div>
        <div className="protection-field"><label>CÔNG SUẤT LIÊN TỤC (W)</label><input type="number" min="10" max="10000" value={speaker.continuousPowerW} onChange={(event) => updateSpeaker("continuousPowerW", event.target.value)} /></div>
        <div className="protection-field"><label>TRỞ KHÁNG DANH ĐỊNH (Ω)</label><input type="number" min="2" max="32" value={speaker.nominalImpedanceOhm} onChange={(event) => updateSpeaker("nominalImpedanceOhm", event.target.value)} /></div>
        <div className="protection-field"><label>GAIN AMPLI (dB)</label><input type="number" min="0" max="60" value={speaker.amplifierGainDb} onChange={(event) => updateSpeaker("amplifierGainDb", event.target.value)} /></div>
        <div className="protection-field"><label>INPUT SENSITIVITY AMPLI (Vrms)</label><input type="number" min="0.1" max="10" step="0.1" value={speaker.ampInputSensitivityVrms} onChange={(event) => updateSpeaker("ampInputSensitivityVrms", event.target.value)} /></div>
        <div className="protection-field"><label>BIÊN AN TOÀN (dB)</label><input type="number" min="1" max="12" step="0.5" value={speaker.safetyMarginDb} onChange={(event) => updateSpeaker("safetyMarginDb", event.target.value)} /></div>
      </div>

      <div className="protection-results">
        <article><small>MAX SPEAKER VOLTAGE</small><b>{calculation.speakerVoltageVrms.toFixed(1)} Vrms</b><span>Ước tính từ P liên tục × Z</span></article>
        <article><small>LIMITER INPUT THRESHOLD</small><b>{calculation.thresholdDbu.toFixed(1)} dBu</b><span>{calculation.targetInputVrms.toFixed(3)} Vrms · margin {speaker.safetyMarginDb} dB</span></article>
        <article><small>AMP INPUT SENSITIVITY</small><b>{calculation.sensitivityDbu.toFixed(1)} dBu</b><span>{speaker.ampInputSensitivityVrms.toFixed(2)} Vrms</span></article>
      </div>

      <div className="protection-subheading"><Users /><b>Quản lý micro đang mở</b><span>{calculation.openMics}/ {channels.length} OPEN</span></div>
      <div className="mic-channel-list">
        {channels.map((channel) => <div className="mic-channel-row" key={channel.id}>
          <label className="mic-channel-toggle"><input type="checkbox" checked={channel.open} onChange={(event) => updateChannel(channel.id, { open: event.target.checked })} /><span>{channel.name}</span></label>
          <label className="mic-trim">TRIM <input type="number" min="-24" max="12" step="0.5" value={channel.gainTrimDb} onChange={(event) => updateChannel(channel.id, { gainTrimDb: numberValue(event.target.value, 0, -24, 12) })} /> dB</label>
        </div>)}
      </div>
      <div className="multi-mic-summary">
        <RadioTower /><div><b>{calculation.openMics} micro đang mở</b><span>Ước tính bất lợi gain-before-feedback khoảng {calculation.theoreticalGainPenaltyDb.toFixed(1)} dB so với một micro (10·log₁₀N, chỉ là quy tắc gần đúng).</span></div>
      </div>
      <div className="protection-actions">
        <button className="secondary" onClick={addChannel} disabled={channels.length >= 16}>Thêm kênh micro</button>
        <button onClick={exportProfile}><Download /> Xuất hồ sơ bảo vệ loa / DSP</button>
      </div>
      {notice && <p className="device-notice" role="status">{notice}</p>}
      <div className="warning protection-warning"><AlertTriangle /><span>Chỉ là tính toán tham khảo. Kết quả phụ thuộc đúng gain ampli, chế độ limiter RMS/peak, tải thực, đấu nối và thông số nhà sản xuất. Chưa kết nối hoặc ghi tham số vào DSP. Nhiều micro mở không thể thay thế phép đo gain-before-feedback thực tế; hãy mute kênh không dùng và kiểm tra từng micro.</span></div>
    </section>
  );
}
