import { useMemo, useState } from "react";
import { usePersistentState } from "./usePersistentState";
import { buildGeometricDelayPlan } from "./systemAlignmentReview";
import type { AlignmentSpeaker } from "./systemAlignmentReview";

export default function SystemAlignmentReviewPanel() {
 const [speakers] = usePersistentState<AlignmentSpeaker[]>("church-audio-room-speakers",[]);
 const [listener,setListener] = useState({x:5,y:5,z:1.2});
 const [speed,setSpeed] = useState(343);
 const plan = useMemo(()=>buildGeometricDelayPlan(speakers,listener,speed),[speakers,listener,speed]);
 const update=(key:"x"|"y"|"z",value:string)=>setListener(current=>({...current,[key]:Number(value)}));
 return <section className="panel spatial-analysis-block">
  <div className="heading"><h2>Căn chỉnh hệ thống · v0.91–v0.95</h2><span>READ ONLY</span></div>
  <p className="muted">Ước lượng Delay hình học theo một tọa độ nghe, sau đó xác minh bằng đo impulse/transfer đồng bộ. Dữ liệu phase và EQ chuyên sâu tiếp tục dùng các phép đo trong mục Transfer Function.</p>
  <h3>v0.91 · Delay từng loa/vùng tại vị trí nghe</h3>
  <div className="spatial-analysis-controls">
   <label>NGƯỜI NGHE X (m)<input type="number" step="0.1" value={listener.x} onChange={e=>update("x",e.target.value)}/></label>
   <label>NGƯỜI NGHE Y (m)<input type="number" step="0.1" value={listener.y} onChange={e=>update("y",e.target.value)}/></label>
   <label>CAO ĐỘ TAI Z (m)<input type="number" step="0.05" value={listener.z} onChange={e=>update("z",e.target.value)}/></label>
   <label>TỐC ĐỘ ÂM (m/s)<input type="number" min="300" max="360" step="1" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label>
  </div>
  {plan.status==="ready" ? <>
   <div className="spatial-analysis-stats">
    <article><small>SỐ LOA</small><b>{plan.rows.length}</b></article>
    <article><small>LOA MỐC XA NHẤT</small><b>{plan.rows.find(r=>r.reference)?.speakerName ?? "—"}</b></article>
    <article><small>KHOẢNG CÁCH MỐC</small><b>{plan.referenceDistanceM?.toFixed(2)} m</b></article>
   </div>
   <div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Loa</th><th>Khoảng cách</th><th>Delay sơ bộ</th><th>Vai trò</th></tr></thead><tbody>
    {plan.rows.map(row=><tr key={row.speakerId}><td>{row.zone}</td><td>{row.speakerName}</td><td>{row.distanceM.toFixed(2)} m</td><td>{row.delayMs.toFixed(2)} ms</td><td>{row.reference?"Mốc 0 ms":"Cần xác minh"}</td></tr>)}
   </tbody></table></div>
  </> : <p className="warning">{plan.reason} Hãy thêm ít nhất hai loa có tọa độ trong mô hình 3D.</p>}
  <p className="warning">{plan.reason} Kết quả là hình học, không phải delay cuối cùng cho DSP.</p>
  <h3>v0.92 · v0.93 · Phase, thời gian đến và polarity</h3>
  <p>Đã có bộ phân tích phase-delay yêu cầu thu đồng thời, chung hardware clock, hiệu chuẩn từng kênh và latency đã được đặc trưng. Phân tích polarity chỉ đưa ra dấu hiệu để kiểm tra; không tự đảo polarity.</p>
  <h3>v0.94 · v0.95 · Auto EQ đa vị trí</h3>
  <p>Tiếp tục dùng bộ Auto EQ hiện có: cần đáp tuyến transfer có coherence đạt chuẩn, đo lặp và nhiều vị trí nghe. Đề xuất chỉ cắt, không boost; cần kiểm tra thủ công và không ghi trực tiếp vào DSP.</p>
 </section>;
}
