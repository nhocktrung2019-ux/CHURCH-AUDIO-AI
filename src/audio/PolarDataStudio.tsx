import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp, Download, Radar, AlertTriangle } from "lucide-react";

type PolarPoint={frequencyHz:number;plane:"H"|"V";angleDeg:number;levelDb:number};
type ParsedFile={name:string;points:PolarPoint[]};
function parsePolarCsv(source:string):PolarPoint[]{
  const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<3)throw new Error("File cần có dòng tiêu đề và ít nhất hai dòng dữ liệu.");
  const delimiter=lines[0].includes("\t")?"\t":lines[0].includes(";")?";":",";
  const headers=lines[0].toLowerCase().split(delimiter).map(x=>x.trim().replace(/[\s-]+/g,"_"));
  const find=(names:string[])=>headers.findIndex(h=>names.includes(h));
  const fi=find(["frequency_hz","freq_hz","frequency","freq","hz"]);
  const ai=find(["angle_deg","angle","degrees","deg"]);
  const li=find(["level_db","spl_db","relative_db","magnitude_db","level","spl","db"]);
  const pi=find(["plane","axis","orientation"]);
  if(fi<0||ai<0||li<0)throw new Error("Không nhận dạng tiêu đề cột. Dùng frequency_hz, angle_deg, level_db và plane (H/V).");
  const points:PolarPoint[]=[];
  for(const line of lines.slice(1)){
    const cells=line.split(delimiter).map(x=>x.trim().replace(/^["']|["']$/g,""));
    const frequencyHz=Number(cells[fi]),angleDeg=Number(cells[ai]),levelDb=Number(cells[li]);
    const planeText=pi>=0?(cells[pi]??"V").toUpperCase():"V";
    const plane=planeText.startsWith("H")?"H":"V";
    if(!Number.isFinite(frequencyHz)||frequencyHz<20||frequencyHz>40000||!Number.isFinite(angleDeg)||angleDeg< -180||angleDeg>180||!Number.isFinite(levelDb))continue;
    points.push({frequencyHz,plane,angleDeg,levelDb});
  }
  if(points.length<3)throw new Error("Không đủ dữ liệu hợp lệ. Góc phải nằm trong -180° đến +180° và tần số trong 20–40000 Hz.");
  return points.sort((a,b)=>a.frequencyHz-b.frequencyHz||a.angleDeg-b.angleDeg);
}
function interpolateCrossing(a:{angleDeg:number;relativeDb:number},b:{angleDeg:number;relativeDb:number},threshold:number){
  const span=b.relativeDb-a.relativeDb;
  if(Math.abs(span)<1e-9)return(a.angleDeg+b.angleDeg)/2;
  return a.angleDeg+(threshold-a.relativeDb)/span*(b.angleDeg-a.angleDeg);
}
export default function PolarDataStudio(){
  const [file,setFile]=useState<ParsedFile|null>(null);
  const [selectedFrequency,setSelectedFrequency]=useState(1000);
  const [selectedPlane,setSelectedPlane]=useState<"H"|"V">("V");
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  const frequencies=useMemo(()=>file?Array.from(new Set(file.points.filter(p=>p.plane===selectedPlane).map(p=>p.frequencyHz))).sort((a,b)=>a-b):[],[file,selectedPlane]);
  const currentFrequency=frequencies.length?frequencies.reduce((best,value)=>Math.abs(value-selectedFrequency)<Math.abs(best-selectedFrequency)?value:best,frequencies[0]):null;
  const polar=useMemo(()=>{
    if(!file||currentFrequency===null)return[];
    const data=file.points.filter(p=>p.plane===selectedPlane&&p.frequencyHz===currentFrequency).sort((a,b)=>a.angleDeg-b.angleDeg);
    if(!data.length)return[];
    const zero=[...data].sort((a,b)=>Math.abs(a.angleDeg)-Math.abs(b.angleDeg))[0];
    return data.map(p=>({...p,relativeDb:p.levelDb-zero.levelDb}));
  },[file,currentFrequency,selectedPlane]);
  const beamwidth=useMemo(()=>{
    if(polar.length<3)return null;
    const positive=polar.filter(p=>p.angleDeg>=0).sort((a,b)=>a.angleDeg-b.angleDeg);
    const negative=polar.filter(p=>p.angleDeg<=0).sort((a,b)=>b.angleDeg-a.angleDeg);
    const findSide=(side:typeof positive)=>{for(let i=1;i<side.length;i++){const previous=side[i-1],next=side[i];if(previous.relativeDb> -6&&next.relativeDb<= -6)return interpolateCrossing(previous,next,-6);}return null;};
    const right=findSide(positive),left=findSide(negative);
    return {left,right,width:left!==null&&right!==null?Math.abs(right-left):null};
  },[polar]);
  const importFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const selected=event.target.files?.[0];if(!selected)return;
    setError("");setStatus("");
    try{const points=parsePolarCsv(await selected.text());setFile({name:selected.name,points});setSelectedPlane(points.some(p=>p.plane==="V")?"V":"H");setSelectedFrequency(points[0].frequencyHz);setStatus("Đã nhập "+points.length+" polar samples.");}
    catch(cause){setFile(null);setError(cause instanceof Error?cause.message:"Không đọc được file polar.");}
    event.target.value="";
  };
  const downloadTemplate=()=>{
    const csv="frequency_hz,plane,angle_deg,level_db\n1000,V,-90,-18\n1000,V,-60,-8\n1000,V,-30,-2\n1000,V,0,0\n1000,V,30,-2\n1000,V,60,-8\n1000,V,90,-18\n";
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="loudspeaker-polar-template.csv";anchor.click();URL.revokeObjectURL(url);
  };
  const points=polar.map(p=>{const radius=108*Math.pow(10,Math.max(-36,p.relativeDb)/20);const angle=p.angleDeg*Math.PI/180;return(160+radius*Math.sin(angle)).toFixed(1)+","+(132-radius*Math.cos(angle)).toFixed(1);});
  const uniquePlanes=file?Array.from(new Set(file.points.map(p=>p.plane))):[];
  return <section className="panel polar-studio">
    <div className="heading"><Radar/><h2>Loudspeaker Polar Data Studio</h2><span>FREQUENCY / DIRECTIVITY</span></div>
    <p className="muted">Nhập polar data CSV do hãng hoặc phòng lab cung cấp để kiểm tra beamwidth theo tần số và trục ngang/dọc. Không tự suy diễn dữ liệu polar từ catalogue.</p>
    <div className="polar-actions"><label className="polar-upload"><FileUp/> Import manufacturer CSV<input type="file" accept=".csv,.txt" onChange={event=>void importFile(event)}/></label><button className="secondary" onClick={downloadTemplate}><Download/> CSV template</button></div>
    {error&&<p className="error"><AlertTriangle/> {error}</p>}{status&&<p className="device-notice">{status}</p>}
    {file&&<>
      <div className="polar-file-info"><b>{file.name}</b><small>{file.points.length} datapoints · {frequencies.length} frequencies · planes: {uniquePlanes.join(" / ")}</small></div>
      <div className="polar-controls"><label>MEASUREMENT PLANE<select value={selectedPlane} onChange={e=>setSelectedPlane(e.target.value as "H"|"V")}><option value="V">Vertical</option><option value="H">Horizontal</option></select></label><label>FREQUENCY<select value={currentFrequency??selectedFrequency} onChange={e=>setSelectedFrequency(+e.target.value)}>{frequencies.map(f=><option key={f} value={f}>{f>=1000?(f/1000)+" kHz":f+" Hz"}</option>)}</select></label></div>
      {polar.length>0&&<div className="polar-result-grid"><div className="polar-chart"><svg viewBox="0 0 320 265" role="img" aria-label="Loudspeaker polar directivity chart"><circle cx="160" cy="132" r="108" fill="none" stroke="#344b57"/><circle cx="160" cy="132" r="76" fill="none" stroke="#2c414b" strokeDasharray="3 4"/><circle cx="160" cy="132" r="54" fill="none" stroke="#2c414b" strokeDasharray="3 4"/><circle cx="160" cy="132" r="27" fill="none" stroke="#2c414b" strokeDasharray="3 4"/><path d="M160 24 V240 M52 132 H268 M84 56 L236 208 M84 208 L236 56" stroke="#2b414c" strokeDasharray="4 5"/><polyline points={points.join(" ")} fill="rgba(101,210,182,.12)" stroke="#65d2b6" strokeWidth="2" strokeLinejoin="round"/></svg><small className="muted">{selectedPlane==="V"?"Vertical":"Horizontal"} polar · 0 dB normalized to nearest on-axis sample</small></div><div className="polar-metrics"><article><small>-6 dB BEAMWIDTH</small><b>{beamwidth?.width===null||beamwidth?.width===undefined?"Not crossed":beamwidth.width.toFixed(1)+"°"}</b></article><article><small>NEGATIVE EDGE</small><b>{beamwidth?.left===null||beamwidth?.left===undefined?"—":beamwidth.left.toFixed(1)+"°"}</b></article><article><small>POSITIVE EDGE</small><b>{beamwidth?.right===null||beamwidth?.right===undefined?"—":beamwidth.right.toFixed(1)+"°"}</b></article><article><small>ON-AXIS NORMALIZATION</small><b>{(currentFrequency ?? 0)>=1000?((currentFrequency ?? 0)/1000)+" kHz":(currentFrequency ?? 0)+" Hz"}</b></article></div></div>}
      <div className="table-wrap"><table><thead><tr><th>Angle</th><th>Measured level</th><th>Relative to on-axis</th></tr></thead><tbody>{polar.filter((_,i)=>i%Math.max(1,Math.floor(polar.length/16))===0).slice(0,16).map(p=><tr key={p.angleDeg}><td>{p.angleDeg.toFixed(0)}°</td><td>{p.levelDb.toFixed(1)} dB</td><td>{p.relativeDb.toFixed(1)} dB</td></tr>)}</tbody></table></div>
    </>}
    <p className="warning">Định dạng hiện hỗ trợ CSV dạng bảng: frequency_hz, plane (H/V), angle_deg, level_db. Để tạo mô hình dự đoán đáng tin cậy cần polar magnitude và phase theo nhiều góc/tần số, dữ liệu từng driver/band, delay/filter và preset chính xác. CSV này là công cụ kiểm tra directivity; chưa phải bộ giải GLL/EASE và chưa tự áp dụng vào map phủ âm.</p>
  </section>;
}
