import type { ZoneSplRecord } from "./zoneSplUniformity";

export type PropagationSpeaker = {
  id: number; name: string; model: string; zone: string;
  x: number; y: number; z: number; azimuth: number;
  coverage: number; verticalCoverage: number;
};
export type PropagationConfig = {
  lengthM: number; widthM: number; earHeightM: number;
  referenceSplAt1m: number; columns?: number; rows?: number;
};
export type PropagationCell = { xM: number; yM: number; levelDb: number | null };
export type PropagationResult = {
  status: "ready" | "blocked"; cells: PropagationCell[];
  columns: number; rows: number; minDb: number | null; maxDb: number | null;
  model: "free-field-directivity-estimate"; writeEnabled: false; reason: string;
};
const finite = (value: number) => Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const toDb = (energy: number) => energy > 0 && finite(energy) ? 10 * Math.log10(energy) : null;

/** Relative free-field estimate. Azimuth is measured counter-clockwise from +X. */
export function estimatePropagationAt(
  speakers: PropagationSpeaker[], xM: number, yM: number,
  earHeightM: number, referenceSplAt1m: number,
): number | null {
  if (!finite(xM) || !finite(yM) || !finite(earHeightM) || !finite(referenceSplAt1m) || !speakers.length) return null;
  let totalEnergy = 0;
  for (const speaker of speakers) {
    if (![speaker.x,speaker.y,speaker.z,speaker.azimuth,speaker.coverage,speaker.verticalCoverage].every(finite)) continue;
    const dx = xM - speaker.x, dy = yM - speaker.y, dz = earHeightM - speaker.z;
    const distance = Math.max(1, Math.hypot(dx,dy,dz));
    const bearing = Math.atan2(dy,dx) * 180 / Math.PI;
    const rawDelta = ((bearing - speaker.azimuth + 540) % 360) - 180;
    const horizontalOffAxis = Math.max(0, Math.abs(rawDelta) - clamp(speaker.coverage,5,360)/2);
    const elevation = Math.atan2(dz,Math.max(0.01,Math.hypot(dx,dy))) * 180 / Math.PI;
    const verticalOffAxis = Math.max(0, Math.abs(elevation) - clamp(speaker.verticalCoverage,5,180)/2);
    const horizontalLoss = Math.min(18, 12 * (horizontalOffAxis / Math.max(5,speaker.coverage/2)) ** 2);
    const verticalLoss = Math.min(12, 8 * (verticalOffAxis / Math.max(5,speaker.verticalCoverage/2)) ** 2);
    const level = referenceSplAt1m - 20 * Math.log10(distance) - horizontalLoss - verticalLoss;
    totalEnergy += 10 ** (level / 10);
  }
  return toDb(totalEnergy);
}

export function simulateSoundField(
  speakers: PropagationSpeaker[], config: PropagationConfig,
): PropagationResult {
  const columns = Math.round(config.columns ?? 25), rows = Math.round(config.rows ?? 17);
  const blocked = (reason: string): PropagationResult => ({
    status:"blocked",cells:[],columns,rows,minDb:null,maxDb:null,
    model:"free-field-directivity-estimate",writeEnabled:false,reason,
  });
  if (!finite(config.lengthM) || !finite(config.widthM) || config.lengthM <= 0 || config.widthM <= 0 ||
      !finite(config.earHeightM) || config.earHeightM < 0.5 || config.earHeightM > 2.2 ||
      !finite(config.referenceSplAt1m) || config.referenceSplAt1m < 50 || config.referenceSplAt1m > 120)
    return blocked("Kích thước phòng, cao độ tai nghe hoặc mức tham chiếu không hợp lệ.");
  if (columns < 5 || columns > 61 || rows < 5 || rows > 41) return blocked("Lưới mô phỏng phải nằm trong khoảng 5–61 cột và 5–41 hàng.");
  if (!speakers.length || speakers.some(s => !s.name.trim() || !s.zone.trim() ||
      ![s.x,s.y,s.z,s.azimuth,s.coverage,s.verticalCoverage].every(finite)))
    return blocked("Cần ít nhất một loa có tên, vùng, tọa độ và góc phủ hợp lệ.");
  const cells: PropagationCell[] = [];
  for (let row=0;row<rows;row++) for (let col=0;col<columns;col++) {
    const xM = columns === 1 ? 0 : col/(columns-1)*config.lengthM;
    const yM = rows === 1 ? 0 : row/(rows-1)*config.widthM;
    cells.push({xM,yM,levelDb:estimatePropagationAt(speakers,xM,yM,config.earHeightM,config.referenceSplAt1m)});
  }
  const levels = cells.map(c=>c.levelDb).filter((v):v is number=>v!==null&&finite(v));
  return {status:"ready",cells,columns,rows,minDb:Math.min(...levels),maxDb:Math.max(...levels),
    model:"free-field-directivity-estimate",writeEnabled:false,
    reason:"Mô phỏng tương đối dạng trường tự do: suy hao khoảng cách 20 log10(r), góc phủ ngang/dọc gần đúng và cộng năng lượng các nguồn độc lập. Không mô hình hóa phản xạ, hấp thụ, vật cản, đáp tuyến theo tần số, pha hoặc giới hạn loa. Mức tham chiếu tại 1 m phải được kỹ thuật viên hiệu chuẩn; đây không phải phép đo SPL."};
}

export type SimulationResidual = { zone:string; position:string; xM:number; yM:number; measuredDb:number; simulatedDb:number; residualDb:number };
export type SimulationComparison = { status:"ready"|"blocked"; rows:SimulationResidual[]; meanAbsoluteErrorDb:number|null; reason:string };
/** Compare only calibrated SPL captures at explicit measured coordinates and a common input/offset. */
export function compareMeasuredToSimulation(
  records: ZoneSplRecord[], speakers: PropagationSpeaker[], config: PropagationConfig,
): SimulationComparison {
  const valid=records.filter(r=>r.unit==="dB SPL");
  if(!valid.length) return {status:"blocked",rows:[],meanAbsoluteErrorDb:null,reason:"Chưa có bản ghi dB SPL đã hiệu chuẩn."};
  if(valid.some(r=>!finite(r.xM as number)||!finite(r.yM as number)||!finite(r.levelDb)||r.levelDb<=-99||
      !finite(r.durationSeconds)||r.durationSeconds<=0||!finite(r.calibrationOffsetDb as number)))
    return {status:"blocked",rows:[],meanAbsoluteErrorDb:null,reason:"Mọi điểm đối chiếu cần tọa độ X/Y, thời lượng, SPL hợp lệ và offset hiệu chuẩn."};
  const input=valid[0].inputLabel, offset=valid[0].calibrationOffsetDb as number;
  if(valid.some(r=>r.inputLabel!==input||Math.abs((r.calibrationOffsetDb as number)-offset)>0.01))
    return {status:"blocked",rows:[],meanAbsoluteErrorDb:null,reason:"Không thể trộn các đầu vào hoặc offset hiệu chuẩn khác nhau."};
  const groups=new Map<string,ZoneSplRecord[]>();
  for(const r of valid){const key=[r.zone,r.position,r.xM,r.yM].join("|");if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(r);}
  const rows:SimulationResidual[]=[];
  for(const captures of groups.values()){
    const first=captures[0], duration=captures.reduce((sum,r)=>sum+r.durationSeconds,0);
    const energy=captures.reduce((sum,r)=>sum+10**(r.levelDb/10)*r.durationSeconds,0)/duration;
    const simulatedDb=estimatePropagationAt(speakers,first.xM!,first.yM!,config.earHeightM,config.referenceSplAt1m);
    if(simulatedDb===null||!finite(energy)||energy<=0) continue;
    const measuredDb=10*Math.log10(energy);
    rows.push({zone:first.zone,position:first.position,xM:first.xM!,yM:first.yM!,measuredDb,simulatedDb,residualDb:measuredDb-simulatedDb});
  }
  if(!rows.length) return {status:"blocked",rows,meanAbsoluteErrorDb:null,reason:"Không tạo được điểm so sánh tại tọa độ đo."};
  return {status:"ready",rows,meanAbsoluteErrorDb:rows.reduce((s,r)=>s+Math.abs(r.residualDb),0)/rows.length,
    reason:"Sai lệch chỉ có ý nghĩa khi mức tham chiếu, vị trí, input và hiệu chuẩn tương thích. Không tự hiệu chỉnh mô hình từ dữ liệu này."};
}

export type AcousticFinding = { severity:"info"|"review"|"warning"; title:string; detail:string; action:string };
/** Deterministic, explainable rule-based assistant; it is not a generative diagnosis. */
export function buildAcousticAssistantFindings(comparison:SimulationComparison):AcousticFinding[] {
  if(comparison.status!=="ready") return [{severity:"info",title:"Chưa đủ bằng chứng",detail:comparison.reason,action:"Bổ sung phép đo SPL đã hiệu chuẩn tại các tọa độ X/Y."}];
  const findings:AcousticFinding[]=[];
  const mean=comparison.meanAbsoluteErrorDb ?? 0;
  if(mean>8) findings.push({severity:"warning",title:"Sai lệch mô phỏng lớn",detail:`Sai số tuyệt đối trung bình ${mean.toFixed(1)} dB; mô hình đơn giản chưa mô tả đủ hiện trường.`,action:"Kiểm tra mức tham chiếu 1 m, góc loa, vị trí đo, vật cản và phản xạ phòng."});
  else if(mean>4) findings.push({severity:"review",title:"Cần rà soát mô hình",detail:`Sai số tuyệt đối trung bình ${mean.toFixed(1)} dB.`,action:"Đo bổ sung nhiều vị trí và xác minh hướng tính/góc phủ của từng loa."});
  else findings.push({severity:"info",title:"Sai lệch trung bình trong ngưỡng sàng lọc",detail:`Sai số tuyệt đối trung bình ${mean.toFixed(1)} dB; không đồng nghĩa mô hình đã được xác nhận.`,action:"Tiếp tục kiểm chứng ở các vùng và tần số khác."});
  const byZone=new Map<string,SimulationResidual[]>();
  for(const row of comparison.rows){if(!byZone.has(row.zone))byZone.set(row.zone,[]);byZone.get(row.zone)!.push(row);}
  for(const [zone,rows] of byZone){
    const residual=rows.reduce((s,r)=>s+r.residualDb,0)/rows.length;
    if(residual < -3) findings.push({severity:"review",title:`Vùng ${zone} thấp hơn mô phỏng`,detail:`SPL đo trung bình thấp hơn ${Math.abs(residual).toFixed(1)} dB tại ${rows.length} vị trí.`,action:"Kiểm tra che khuất, hướng loa, kết nối và mức vận hành; đo xác nhận trước khi thay đổi Gain."});
    if(residual > 3) findings.push({severity:"review",title:`Vùng ${zone} cao hơn mô phỏng`,detail:`SPL đo trung bình cao hơn ${residual.toFixed(1)} dB tại ${rows.length} vị trí.`,action:"Kiểm tra phản xạ, chồng phủ loa và nguồn âm lân cận; không tự giảm Gain."});
  }
  return findings;
}
