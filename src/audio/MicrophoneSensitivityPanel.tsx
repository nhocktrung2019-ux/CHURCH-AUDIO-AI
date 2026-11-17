import { Activity, RotateCcw } from "lucide-react";

export type MicrophoneSensitivityProfile = {
  name: string;
  model: string;
  serialNumber: string;
  sensitivityMvPa: number | null;
  notes: string;
};

const EMPTY_PROFILE: MicrophoneSensitivityProfile = {
  name: "",
  model: "",
  serialNumber: "",
  sensitivityMvPa: null,
  notes: "",
};

type Props = {
  value: MicrophoneSensitivityProfile | null;
  onChange: (value: MicrophoneSensitivityProfile | null) => void;
  activeDeviceLabel?: string;
};

export default function MicrophoneSensitivityPanel({ value, onChange, activeDeviceLabel }: Props) {
  const profile = value ?? EMPTY_PROFILE;
  function update<K extends keyof MicrophoneSensitivityProfile>(
    key: K,
    next: MicrophoneSensitivityProfile[K],
  ): void {
    onChange({ ...profile, [key]: next });
  }

  const sensitivity = profile.sensitivityMvPa;
  const dbvPerPa =
    sensitivity !== null && Number.isFinite(sensitivity) && sensitivity > 0
      ? 20 * Math.log10(sensitivity / 1000)
      : null;

  return (
    <section className="panel mic-sensitivity-panel">
      <div className="heading">
        <Activity />
        <h2>Microphone Sensitivity · Hồ sơ micro</h2>
        <span>{value ? "PROFILE SAVED" : "NOT SET"}</span>
      </div>
      <p className="muted">
        Lưu độ nhạy ghi trên datasheet của micro đo để tra cứu trong các phiên làm việc.
        Nhập theo mV/Pa; ứng dụng tự quy đổi sang dBV/Pa.
      </p>
      {activeDeviceLabel && (
        <div className="mic-profile-device">
          <small>INPUT ĐANG CHỌN</small>
          <b>{activeDeviceLabel}</b>
        </div>
      )}
      <div className="form-grid">
        <div>
          <label htmlFor="mic-profile-name">TÊN MICRO / THIẾT BỊ</label>
          <input
            id="mic-profile-name"
            value={profile.name}
            placeholder="Ví dụ: Measurement Mic"
            onChange={(event) => update("name", event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="mic-profile-model">HÃNG / MODEL</label>
          <input
            id="mic-profile-model"
            value={profile.model}
            placeholder="Ví dụ: ECM8000"
            onChange={(event) => update("model", event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="mic-profile-sensitivity">ĐỘ NHẠY (mV/Pa)</label>
          <input
            id="mic-profile-sensitivity"
            type="number"
            min="0.001"
            max="2000"
            step="0.001"
            value={sensitivity ?? ""}
            placeholder="Nhập theo datasheet"
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === "" ? null : Number(raw);
              update("sensitivityMvPa", parsed !== null && Number.isFinite(parsed) && parsed > 0 && parsed <= 2000 ? parsed : null);
            }}
          />
        </div>
        <div>
          <label htmlFor="mic-profile-serial">SERIAL NUMBER</label>
          <input
            id="mic-profile-serial"
            value={profile.serialNumber}
            placeholder="Số serial (nếu có)"
            onChange={(event) => update("serialNumber", event.target.value)}
          />
        </div>
      </div>
      <div className="mic-sensitivity-reading">
        <div>
          <small>ĐỘ NHẠY THEO HỒ SƠ</small>
          <strong>{sensitivity === null ? "—" : `${sensitivity.toFixed(3)} mV/Pa`}</strong>
        </div>
        <div>
          <small>QUY ĐỔI TƯƠNG ĐƯƠNG</small>
          <strong>{dbvPerPa === null ? "—" : `${dbvPerPa.toFixed(2)} dBV/Pa`}</strong>
        </div>
      </div>
      <label htmlFor="mic-profile-notes">GHI CHÚ / NGUỒN THÔNG SỐ</label>
      <textarea
        id="mic-profile-notes"
        rows={2}
        value={profile.notes}
        placeholder="Datasheet, preamp/interface, ngày kiểm tra…"
        onChange={(event) => update("notes", event.target.value)}
      />
      <button className="secondary" onClick={() => onChange(null)} disabled={!value}>
        <RotateCcw /> Xóa hồ sơ độ nhạy
      </button>
      <p className="warning">
        Độ nhạy mV/Pa chỉ mô tả micro theo datasheet, không đủ để tự suy ra dB SPL từ dBFS.
        Gain của preamp, ADC, bộ lọc/AGC và đường âm thanh Android có thể thay đổi theo thiết bị.
        Muốn đọc SPL tuyệt đối, vẫn phải hiệu chuẩn bằng acoustic calibrator 94/114 dB tại 1 kHz
        hoặc hệ tham chiếu đã được xác minh.
      </p>
    </section>
  );
}
