import { useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck, VolumeX, Bookmark, Trash2 } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";
import { usePersistentState } from "./usePersistentState";

type SavedFeedbackPoint = {
  id: string;
  frequencyHz: number;
  levelDbfs: number | null;
  prominenceDb: number | null;
  recommendedCutDb: number | null;
  q: number | null;
  source: "rta-cursor" | "narrow-peak";
  createdAt: number;
  note: string;
};

type Props = {
  history: number[][];
  selectedFrequencyHz?: number | null;
  selectedLevelDbfs?: number | null;
};

function formatFrequency(frequencyHz: number): string {
  return frequencyHz >= 1000
    ? `${(frequencyHz / 1000).toFixed(2)} kHz`
    : `${Math.round(frequencyHz)} Hz`;
}

export default function FeedbackMonitor({
  history,
  selectedFrequencyHz = null,
  selectedLevelDbfs = null,
}: Props) {
  const peaks = useMemo(() => detectNarrowPeaks(history), [history]);
  const [savedPoints, setSavedPoints] = usePersistentState<SavedFeedbackPoint[]>(
    "church-audio-saved-feedback-points",
    [],
  );
  const [note, setNote] = useState("");

  const savePoint = (
    source: SavedFeedbackPoint["source"],
    values: {
      frequencyHz: number;
      levelDbfs: number | null;
      prominenceDb?: number | null;
      recommendedCutDb?: number | null;
      q?: number | null;
    },
  ) => {
    if (!Number.isFinite(values.frequencyHz) || values.frequencyHz < 20 || values.frequencyHz > 20000) return;
    const record: SavedFeedbackPoint = {
      id: `${Date.now()}-${Math.round(values.frequencyHz)}`,
      frequencyHz: values.frequencyHz,
      levelDbfs: values.levelDbfs !== null && Number.isFinite(values.levelDbfs) ? values.levelDbfs : null,
      prominenceDb: values.prominenceDb ?? null,
      recommendedCutDb: values.recommendedCutDb ?? null,
      q: values.q ?? null,
      source,
      createdAt: Date.now(),
      note: note.trim(),
    };
    setSavedPoints((current) => [record, ...current].slice(0, 100));
  };

  return (
    <section className="panel" id="feedback">
      <div className="heading">
        <ShieldAlert />
        <h2>Feedback Watch · Lưu điểm hú rít</h2>
        <span>{savedPoints.length} SAVED</span>
      </div>
      <p className="muted">
        Phân tích đỉnh hẹp bền vững qua nhiều khung RTA. Các đỉnh chỉ là nghi vấn; cần nghe và
        xác minh trong hệ thống trước khi kết luận đó là tần số hú thật.
      </p>
      <div className="feedback-save-cursor">
        <div>
          <small>ĐIỂM RTA ĐANG CHỌN</small>
          <b>{selectedFrequencyHz === null ? "Chưa chọn tần số" : formatFrequency(selectedFrequencyHz)}</b>
          <small>{selectedLevelDbfs === null ? "—" : `${selectedLevelDbfs.toFixed(1)} dBFS · mức tương đối`}</small>
        </div>
        <button
          type="button"
          disabled={selectedFrequencyHz === null}
          onClick={() => selectedFrequencyHz !== null && savePoint("rta-cursor", {
            frequencyHz: selectedFrequencyHz,
            levelDbfs: selectedLevelDbfs,
          })}
        >
          <Bookmark /> Lưu điểm RTA
        </button>
      </div>
      <label htmlFor="feedback-note">GHI CHÚ CHO ĐIỂM LƯU</label>
      <input
        id="feedback-note"
        value={note}
        maxLength={160}
        placeholder="Ví dụ: hú khi mở micro bục giảng / monitor sân khấu"
        onChange={(event) => setNote(event.target.value)}
      />
      {peaks.length === 0 ? (
        <div className="feedback-clear"><ShieldCheck /><span>Chưa phát hiện đỉnh hẹp ổn định theo ngưỡng hiện tại.</span></div>
      ) : (
        <>
          <div className="feedback-alert"><VolumeX /><b>Phát hiện {peaks.length} đỉnh phổ cần kiểm tra</b></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tần số</th><th>Độ nổi</th><th>Bền vững / tin cậy</th><th>Filter tham khảo</th><th>Q</th><th>Lưu</th></tr></thead>
              <tbody>
                {peaks.map((peak) => (
                  <tr key={peak.index}>
                    <td><b>{formatFrequency(peak.frequencyHz)}</b><small>{peak.levelDb.toFixed(1)} dBFS</small></td>
                    <td>{peak.prominenceDb.toFixed(1)} dB</td>
                    <td><b>{peak.confidence === "high" ? "Cao" : "Trung bình"}</b><small>{peak.persistence}% khung đo</small></td>
                    <td>{peak.recommendedCutDb} dB</td>
                    <td>{peak.q}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Lưu điểm hú ${peak.frequencyHz} Hz`}
                        onClick={() => savePoint("narrow-peak", {
                          frequencyHz: peak.frequencyHz,
                          levelDbfs: peak.levelDb,
                          prominenceDb: peak.prominenceDb,
                          recommendedCutDb: peak.recommendedCutDb,
                          q: peak.q,
                        })}
                      >
                        <Bookmark />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="permission-help">
        <b>Quy trình xác minh</b>
        <span>Hạ master/monitor, mở từng micro và tăng gain từ từ; mute/solo từng kênh để xác định nguồn. Ưu tiên chỉnh hướng, khoảng cách và gain trước khi notch EQ.</span>
      </div>
      <div className="saved-feedback-heading">
        <b>Điểm đã lưu ({savedPoints.length}/100)</b>
        <button
          type="button"
          className="secondary"
          disabled={savedPoints.length === 0}
          onClick={() => setSavedPoints([])}
        >
          <Trash2 /> Xóa toàn bộ
        </button>
      </div>
      {savedPoints.length === 0 ? (
        <p className="muted">Chưa có điểm lưu. Chọn tần số trên RTA hoặc lưu một đỉnh nghi vấn ở phía trên.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Tần số</th><th>Mức</th><th>Nguồn</th><th>Ghi chú</th><th></th></tr></thead>
            <tbody>
              {savedPoints.map((point) => (
                <tr key={point.id}>
                  <td>{new Date(point.createdAt).toLocaleString("vi-VN")}</td>
                  <td><b>{formatFrequency(point.frequencyHz)}</b></td>
                  <td>{point.levelDbfs === null ? "—" : `${point.levelDbfs.toFixed(1)} dBFS`}</td>
                  <td>{point.source === "narrow-peak" ? "Đỉnh hẹp" : "Con trỏ RTA"}</td>
                  <td>{point.note || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Xóa điểm đã lưu"
                      onClick={() => setSavedPoints((current) => current.filter((item) => item.id !== point.id))}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="warning">
        Không tự động áp EQ hoặc xác nhận feedback chỉ từ một microphone. Ứng dụng hiện phân tích
        luồng input đang chọn; nhiều micro độc lập cần audio interface/mixer cung cấp từng kênh riêng.
        dBFS không phải dB SPL nếu chưa hiệu chuẩn.
      </p>
    </section>
  );
}
