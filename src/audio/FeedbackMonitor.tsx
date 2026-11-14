import { useMemo } from "react";
import { ShieldAlert, ShieldCheck, VolumeX } from "lucide-react";
import { detectNarrowPeaks } from "./feedback";

export default function FeedbackMonitor({ history }: { history: number[][] }) {
  const peaks = useMemo(() => detectNarrowPeaks(history), [history]);
  return <section className="panel" id="feedback">
    <div className="heading"><ShieldAlert /><h2>Feedback Watch · Chống hú đa micro</h2><span>LIVE ADVISORY</span></div>
    <p className="muted">Theo dõi đỉnh hẹp bền vững qua nhiều khung RTA, xếp hạng độ tin cậy và gợi ý notch cut nhẹ. Chỉ là dấu hiệu nghi vấn; không thể xác nhận vòng lặp hú chỉ từ một micro đo.</p>
    {peaks.length === 0 ? <div className="feedback-clear"><ShieldCheck /><span>Chưa thấy đỉnh hẹp ổn định theo ngưỡng hiện tại. Hãy kiểm tra ở mức vận hành thực tế và từng micro.</span></div> : <>
      <div className="feedback-alert"><VolumeX /><b>{peaks.length} tần số nghi vấn cần nghe/kiểm tra</b></div>
      <div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Nổi hơn nền</th><th>Ổn định</th><th>Tin cậy</th><th>Notch khởi điểm</th><th>Q</th></tr></thead>
        <tbody>{peaks.map(p => <tr key={p.index}><td><b>{p.frequencyHz.toLocaleString("vi-VN")} Hz</b><small> {p.levelDb.toFixed(1)} dBFS</small></td><td>{p.prominenceDb.toFixed(1)} dB</td><td>{p.persistence}%</td><td>{p.confidence === "high" ? "Cao" : "Trung bình"}</td><td>{p.recommendedCutDb.toFixed(1)} dB</td><td>{p.q.toFixed(1)}</td></tr>)}</tbody>
      </table></div>
    </>}
    <div className="permission-help"><b>Quy trình xử lý nhiều micro</b><span>1) Hạ master/monitor trước khi mở mic. 2) Mở từng micro và tăng gain từ từ. 3) Tìm kênh gây hú bằng mute/solo từng kênh. 4) Ưu tiên giảm gain, chỉnh hướng và khoảng cách mic/loa; sau đó mới notch hẹp đúng kênh. 5) Lặp lại khi mở đồng thời tất cả micro.</span></div>
    <p className="warning">Ứng dụng hiện phân tích một input stream được chọn. Để đo đồng thời nhiều micro độc lập cần audio interface multichannel/mixer gửi từng kênh riêng; Web Audio không thể tự tách các micro đã trộn vào một stereo mix. Không tự động áp filter hoặc tăng gain.</p>
  </section>;
}
