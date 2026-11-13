import{useMemo}from"react";
import{ShieldAlert,ShieldCheck,VolumeX}from"lucide-react";
import{detectNarrowPeaks}from"./feedback";
export default function FeedbackMonitor({history}:{history:number[][]}){
 const peaks=useMemo(()=>detectNarrowPeaks(history),[history]);
 return <section className="panel" id="feedback"><div className="heading"><ShieldAlert/><h2>Feedback Watch · Phát hiện hú rít</h2><span>LIVE ADVISORY</span></div>
 <p className="muted">Theo dõi các đỉnh phổ hẹp tồn tại liên tục qua nhiều khung RTA. Đây là cảnh báo nghi vấn hú, không phải xác nhận vòng lặp feedback.</p>
 {peaks.length===0?<div className="feedback-clear"><ShieldCheck/><span>Chưa phát hiện đỉnh hẹp ổn định theo ngưỡng hiện tại.</span></div>:<><div className="feedback-alert"><VolumeX/><b>Phát hiện {peaks.length} đỉnh phổ cần kiểm tra</b></div><div className="table-wrap"><table><thead><tr><th>Tần số</th><th>Độ nổi</th><th>Filter khởi điểm</th><th>Q</th></tr></thead><tbody>{peaks.map(p=><tr key={p.index}><td><b>{p.frequencyHz.toLocaleString("vi-VN")} Hz</b></td><td>{p.prominenceDb.toFixed(1)} dB</td><td>{p.recommendedCutDb} dB</td><td>{p.q}</td></tr>)}</tbody></table></div></>}
 <p className="warning">Không tự cắt EQ khi chưa xác minh. Hú rít cần kiểm tra mic/loa, gain-before-feedback, vị trí và hướng micro, phản xạ phòng và từng kênh. Chỉ áp dụng notch filter sau khi kỹ thuật viên nghe/đo xác nhận.</p>
 </section>;
}