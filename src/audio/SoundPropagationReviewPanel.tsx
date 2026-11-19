import { useMemo, useState } from "react";
import { Activity, BrainCircuit, Waves } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import type { ZoneSplRecord } from "./zoneSplUniformity";
import { buildAcousticAssistantFindings, compareMeasuredToSimulation, simulateSoundField, type PropagationSpeaker } from "./soundPropagation";

type RoomSpeaker = PropagationSpeaker & { sensitivity?:number|null; powerW?:number|null; impedance:number };
const colorFor=(level:number,min:number,max:number)=>`hsl(${Math.max(0,Math.min(240,240-(level-min)/Math.max(1,max-min)*240))} 78% 52%)`;
export default function SoundPropagationReviewPanel(){
  const [speakers]=usePersistentState<RoomSpeaker[]>("church-audio-room-speakers",[]);
  const [records]=usePersistentState<ZoneSplRecord[]>("church-audio-zone-spl-records-v1",[]);
  const [lengthM]=usePersistentState("church-audio-room-length",28);
  const [widthM]=usePersistentState("church-audio-room-width",16);
  const [earHeightM,setEarHeightM]=useState(1.2);
  const [referenceSplAt1m,setReferenceSplAt1m]=useState(90);
  const config={lengthM,widthM,earHeightM,referenceSplAt1m,columns:25,rows:17};
  const simulation=useMemo(()=>simulateSoundField(speakers,config),[speakers,lengthM,widthM,earHeightM,referenceSplAt1m]);
  const comparison=useMemo(()=>compareMeasuredToSimulation(records,speakers,config),[records,speakers,lengthM,widthM,earHeightM,referenceSplAt1m]);
  const findings=useMemo(()=>buildAcousticAssistantFindings(comparison),[comparison]);
  const measuredCount=records.filter(r=>r.unit==="dB SPL").length;
  return <section className="panel spatial-analysis-block">
    <div className="heading"><Waves/><h3>v0.96–v0.98 · Mô phỏng truyền âm & trợ lý phân tích</h3><span>ADVISORY ONLY</span></div>
    <p className="muted">Bản đồ trường âm tương đối trên mặt bằng phòng, dùng tọa độ loa đang lưu trong mô hình 3D. Không thay đổi mô hình 3D, vị trí loa, nội thất, camera hoặc dữ liệu khảo sát.</p>
    <div className="spatial-analysis-controls">
      <label>CAO ĐỘ TAI NGHE (m)<input type="number" min="0.5" max="2.2" step="0.05" value={earHeightM} onChange={e=>setEarHeightM(Math.max(0.5,Math.min(2.2,Number(e.target.value)||1.2)))}/></label>
      <label>MỨC THAM CHIẾU MỖI LOA TẠI 1 m (dB SPL)<input type="number" min="50" max="120" step="0.5" value={referenceSplAt1m} onChange={e=>setReferenceSplAt1m(Math.max(50,Math.min(120,Number(e.target.value)||90)))}/></label>
    </div>
    {simulation.status==="ready" ? <>
      <div className="spatial-analysis-stats"><article><small>LOA TRONG MÔ HÌNH</small><b>{speakers.length}</b></article><article><small>PHẠM VI MÔ PHỎNG</small><b>{lengthM} × {widthM} m</b></article><article><small>SPL ƯỚC TÍNH</small><b>{simulation.minDb!.toFixed(1)}–{simulation.maxDb!.toFixed(1)} dB</b></article><article><small>ĐIỂM ĐO SPL LƯU</small><b>{measuredCount}</b></article></div>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${simulation.columns},minmax(0,1fr))`,gap:2,padding:8,borderRadius:10,background:"#111923",overflow:"hidden"}} aria-label="Bản đồ mô phỏng SPL tương đối">
        {simulation.cells.map((cell,index)=><div key={index} title={`X ${cell.xM.toFixed(1)} m · Y ${cell.yM.toFixed(1)} m · ${cell.levelDb?.toFixed(1)} dB SPL ước tính`} style={{aspectRatio:"1",background:cell.levelDb===null?"#27313b":colorFor(cell.levelDb,simulation.minDb!,simulation.maxDb!),borderRadius:2,opacity:.9}}/>)}
      </div>
      <div className="axis"><span>Thấp</span><span>Phân bố SPL mô phỏng</span><span>Cao</span></div>
    </> : <p className="warning">{simulation.reason}</p>}
    <p className="warning">Mức tham chiếu 1 m là đầu vào giả định do kỹ thuật viên nhập, không được coi là thông số đo của model loa. Bản đồ chỉ là mô phỏng tương đối, chưa tính phản xạ, hấp thụ, vật cản, đáp tuyến tần số, pha hoặc công suất thực.</p>
    <div className="spatial-analysis-block">
      <div className="heading"><Activity/><h3>v0.97 · Đối chiếu với phép đo tại tọa độ thực</h3></div>
      {comparison.status==="ready" ? <>
        <div className="spatial-analysis-stats"><article><small>ĐIỂM ĐỐI CHIẾU</small><b>{comparison.rows.length}</b></article><article><small>SAI SỐ TUYỆT ĐỐI TB</small><b>{comparison.meanAbsoluteErrorDb!.toFixed(1)} dB</b></article></div>
        <div className="table-wrap"><table><thead><tr><th>Vùng</th><th>Vị trí</th><th>Đo thực tế</th><th>Mô phỏng</th><th>Đo − mô phỏng</th></tr></thead><tbody>{comparison.rows.map((r,i)=><tr key={r.zone+"|"+r.position+"|"+i}><td>{r.zone}</td><td>{r.position}</td><td>{r.measuredDb.toFixed(1)}</td><td>{r.simulatedDb.toFixed(1)}</td><td>{r.residualDb>0?"+":""}{r.residualDb.toFixed(1)} dB</td></tr>)}</tbody></table></div>
      </> : <p className="muted">{comparison.reason} Cần dữ liệu dB SPL có tọa độ X/Y, cùng input và cùng offset hiệu chuẩn. Hiện có {measuredCount} bản ghi SPL.</p>}
    </div>
    <div className="spatial-analysis-block">
      <div className="heading"><BrainCircuit/><h3>v0.98 · Trợ lý AI âm học có giải thích</h3></div>
      {findings.map((f,i)=><article key={i} className={f.severity==="warning"?"warning":f.severity==="review"?"device-notice":"item"} style={{marginBottom:8,padding:10,borderRadius:8}}><b>{f.title}</b><p>{f.detail}</p><small><b>Đề xuất:</b> {f.action}</small></article>)}
      <p className="muted">Đây là bộ quy tắc phân tích có thể kiểm chứng, không phải chẩn đoán AI tự học hoặc mô hình ngôn ngữ. Mọi khuyến nghị cần kỹ thuật viên xác minh.</p>
    </div>
    <p className="warning">READ ONLY · Không phát tín hiệu, không thay đổi Gain/Delay/EQ, không ghi Mixer/DSP/LAN. Không dùng dữ liệu dBFS trong đối chiếu SPL.</p>
  </section>;
}
