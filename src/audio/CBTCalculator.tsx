import { useMemo } from "react";
import { usePersistentState } from "./usePersistentState";
import { Plus, Speaker, Ruler, Activity, Trash2 } from "lucide-react";

type CbtModelId = "CBT 50LA-1" | "CBT 70J-1" | "CBT 100LA-1";
type CbtModel = { heightM: number; horizontalDeg: number; verticalBroadDeg: number; verticalNarrowDeg: number; musicBroadDb: number; musicNarrowDb: number; speechBroadDb: number; speechNarrowDb: number; ratedPowerW: number; impedanceOhm: number; source: string; note: string };
const MODELS: Record<CbtModelId,CbtModel> = {
  "CBT 50LA-1": { heightM:.528,horizontalDeg:150,verticalBroadDeg:20,verticalNarrowDeg:20,musicBroadDb:89,musicNarrowDb:89,speechBroadDb:93,speechNarrowDb:93,ratedPowerW:100,impedanceOhm:8,source:"https://jblpro.com/en-US/products/cbt-50la-1",note:"20° vertical (1.5–16 kHz); sensitivity 89 dB music / 93 dB speech; long-term power 100 W." },
  "CBT 70J-1": { heightM:1.0,horizontalDeg:150,verticalBroadDeg:45,verticalNarrowDeg:25,musicBroadDb:92,musicNarrowDb:93,speechBroadDb:96,speechNarrowDb:98,ratedPowerW:350,impedanceOhm:8,source:"https://jblpro.com/en-US/products/cbt-70j-1",note:"Switchable 45° broad / 25° narrow vertical coverage; sensitivities vary by mode and voicing; 350 W long-term." },
  "CBT 100LA-1": { heightM:1.0,horizontalDeg:150,verticalBroadDeg:40,verticalNarrowDeg:15,musicBroadDb:90,musicNarrowDb:93,speechBroadDb:93,speechNarrowDb:96,ratedPowerW:200,impedanceOhm:8,source:"https://jblpro.com/en-US/products/cbt-100la-1",note:"Broad / narrow vertical modes; approximate published average coverage and sensitivity. Verify the exact model revision and setting." },
};
type CbtSpeaker = { id:number; name:string; model:CbtModelId; heightM:number; downAngleDeg:number; mode:"broad"|"narrow"; voicing:"music"|"speech"; amplifierPowerW:number };
type Plane = { id:number; name:string; distanceM:number; earHeightM:number };
type Listener = { id:number; name:string; planeId:number; offsetM:number };

const DEFAULT_PLANES:Plane[]=[
  {id:1,name:"Plane A · Hàng đầu",distanceM:4,earHeightM:1.2},
  {id:2,name:"Plane B · Giữa trước",distanceM:8,earHeightM:1.2},
  {id:3,name:"Plane C · Giữa sau",distanceM:13,earHeightM:1.2},
  {id:4,name:"Plane D · Cuối phòng",distanceM:19,earHeightM:1.2},
];
const DEFAULT_LISTENERS:Listener[]=[
  {id:1,name:"L1 · Front",planeId:1,offsetM:-.5},{id:2,name:"L2 · Front",planeId:1,offsetM:.5},
  {id:3,name:"L3 · Mid",planeId:2,offsetM:0},{id:4,name:"L4 · Mid",planeId:3,offsetM:0},
  {id:5,name:"L5 · Rear",planeId:4,offsetM:-.5},{id:6,name:"L6 · Rear",planeId:4,offsetM:.5},
];
const COLORS=["#65d2b6","#e7b86c","#8fb2ed"];
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
type Prediction={speakerName:string;spl:number;inCoverage:boolean;offAxisDeg:number;distanceM:number};
export default function CBTCalculator(){
  const [speakers,setSpeakers]=usePersistentState<CbtSpeaker[]>("church-audio-cbt-speakers",[{id:1,name:"CBT Main",model:"CBT 70J-1",heightM:5.2,downAngleDeg:8,mode:"broad",voicing:"music",amplifierPowerW:100}]);
  const [planes,setPlanes]=usePersistentState<Plane[]>("church-audio-cbt-planes",DEFAULT_PLANES);
  const [listeners,setListeners]=usePersistentState<Listener[]>("church-audio-cbt-listeners",DEFAULT_LISTENERS);
  const [targetSpl,setTargetSpl]=usePersistentState("church-audio-cbt-target-spl",85);
  const [roomDepth,setRoomDepth]=usePersistentState("church-audio-cbt-room-depth",24);
  const [roomHeight,setRoomHeight]=usePersistentState("church-audio-cbt-room-height",7);
  const modelInfo=(speaker:CbtSpeaker)=>MODELS[speaker.model];
  const coverage=(speaker:CbtSpeaker)=>speaker.mode==="narrow"?modelInfo(speaker).verticalNarrowDeg:modelInfo(speaker).verticalBroadDeg;
  const sensitivity=(speaker:CbtSpeaker)=>{const m=modelInfo(speaker);if(speaker.voicing==="speech")return speaker.mode==="narrow"?m.speechNarrowDb:m.speechBroadDb;return speaker.mode==="narrow"?m.musicNarrowDb:m.musicBroadDb;};
  const planeMap=useMemo(()=>new Map(planes.map(p=>[p.id,p])),[planes]);
  const predictions=useMemo(()=>listeners.map(listener=>{
    const plane=planeMap.get(listener.planeId)??planes[0];
    const distanceM=clamp(plane.distanceM+listener.offsetM,.5,roomDepth);
    const earHeightM=plane.earHeightM;
    const perSpeaker:Prediction[]=speakers.map(speaker=>{
      const info=modelInfo(speaker);
      const distance=Math.hypot(distanceM,speaker.heightM-earHeightM);
      const rayDownDeg=Math.atan2(speaker.heightM-earHeightM,Math.max(.1,distanceM))*180/Math.PI;
      const offAxisDeg=rayDownDeg-speaker.downAngleDeg;
      const half=Math.max(1,coverage(speaker)/2);
      const inCoverage=Math.abs(offAxisDeg)<=half;
      const angularLossDb=Math.max(-30,-6*Math.pow(Math.abs(offAxisDeg)/half,2));
      const power=Math.max(1,Math.min(info.ratedPowerW,speaker.amplifierPowerW));
      const level=sensitivity(speaker)+10*Math.log10(power)-20*Math.log10(Math.max(1,distance))+angularLossDb;
      return {speakerName:speaker.name,spl:level,inCoverage,offAxisDeg,distanceM:distance};
    });
    const energy=perSpeaker.reduce((sum,p)=>sum+Math.pow(10,p.spl/10),0);
    const combined=energy>0?10*Math.log10(energy):null;
    return {listener,plane,distanceM,earHeightM,perSpeaker,combined,covered:perSpeaker.some(p=>p.inCoverage)};
  }),[listeners,planeMap,planes,speakers,roomDepth]);
  const updateSpeaker=(id:number,patch:Partial<CbtSpeaker>)=>setSpeakers(old=>old.map(s=>s.id===id?{...s,...patch}:s));
  const updatePlane=(id:number,patch:Partial<Plane>)=>setPlanes(old=>old.map(p=>p.id===id?{...p,...patch}:p));
  const addSpeaker=()=>{if(speakers.length>=3)return;const id=Date.now();setSpeakers(old=>[...old,{id,name:"CBT "+(old.length+1),model:"CBT 50LA-1",heightM:5,downAngleDeg:8,mode:"broad",voicing:"music",amplifierPowerW:50}]);};
  const xFor=(distance:number)=>65+clamp(distance,0,roomDepth)/roomDepth*680;
  const yFor=(height:number)=>300-clamp(height,0,roomHeight)/roomHeight*250;
  const rayEnd=(speaker:CbtSpeaker,edgeAngle:number)=>{const run=roomDepth;const h=speaker.heightM-run*Math.tan(edgeAngle*Math.PI/180);return{x:xFor(run),y:yFor(h)};};
  const average=predictions.filter(p=>p.combined!==null).map(p=>p.combined as number);
  const minLevel=average.length?Math.min(...average):null,maxLevel=average.length?Math.max(...average):null;
  return <section className="panel cbt-calculator" id="cbt-calculator">
    <div className="heading"><Speaker/><h2>CBT Calculator · Vertical coverage planner</h2><span>3 CBT / 4 PLANES / 6 LISTENERS</span></div>
    <p className="muted">Thiết kế sơ bộ theo mặt cắt dọc: chọn model, narrow/broad, speech/music, mounting height, down-angle, amplifier power, 4 audience planes và 6 listener points.</p>
    <div className="cbt-summary"><span>Speaker boxes <b>{speakers.length}/3</b></span><span>Listening planes <b>{planes.length}/4</b></span><span>Listener locations <b>{listeners.length}/6</b></span><span>Target <b>{targetSpl} dB</b></span></div>
    <div className="cbt-room-controls">
      <label>ROOM DEPTH (m)<input type="number" min="4" max="60" value={roomDepth} onChange={e=>setRoomDepth(clamp(+e.target.value||4,4,60))}/></label>
      <label>ROOM HEIGHT (m)<input type="number" min="3" max="20" value={roomHeight} onChange={e=>setRoomHeight(clamp(+e.target.value||3,3,20))}/></label>
      <label>TARGET LEVEL (dB SPL)<input type="number" min="60" max="115" value={targetSpl} onChange={e=>setTargetSpl(clamp(+e.target.value||85,60,115))}/></label>
    </div>
    <div className="cbt-speaker-list">{speakers.map((speaker,index)=>{const info=modelInfo(speaker);return <article key={speaker.id} className="cbt-speaker-card">
      <div className="cbt-card-title"><b><i style={{background:COLORS[index]}}/> {speaker.name}</b><button className="icon-button" disabled={speakers.length===1} onClick={()=>setSpeakers(old=>old.filter(s=>s.id!==speaker.id))}><Trash2 size={15}/></button></div>
      <div className="cbt-input-grid">
        <label>MODEL<select value={speaker.model} onChange={e=>{const model=e.target.value as CbtModelId;updateSpeaker(speaker.id,{model,mode:"broad",amplifierPowerW:Math.min(speaker.amplifierPowerW,MODELS[model].ratedPowerW)});}}>{Object.keys(MODELS).map(model=><option key={model} value={model}>{model}</option>)}</select></label>
        <label>NAME<input value={speaker.name} onChange={e=>updateSpeaker(speaker.id,{name:e.target.value})}/></label>
        <label>VERTICAL MODE<select value={speaker.mode} onChange={e=>updateSpeaker(speaker.id,{mode:e.target.value as CbtSpeaker["mode"]})}><option value="broad">Broad · {info.verticalBroadDeg}°</option>{info.verticalNarrowDeg!==info.verticalBroadDeg&&<option value="narrow">Narrow · {info.verticalNarrowDeg}°</option>}</select></label>
        <label>VOICING<select value={speaker.voicing} onChange={e=>updateSpeaker(speaker.id,{voicing:e.target.value as CbtSpeaker["voicing"]})}><option value="music">Music / flat</option><option value="speech">Speech</option></select></label>
        <label>AMPLIFIER POWER (W)<input type="number" min="1" max={info.ratedPowerW} value={speaker.amplifierPowerW} onChange={e=>updateSpeaker(speaker.id,{amplifierPowerW:clamp(+e.target.value||1,1,info.ratedPowerW)})}/></label>
        <label>MOUNTING HEIGHT (m)<input type="number" min="1" max={roomHeight} step=".1" value={speaker.heightM} onChange={e=>updateSpeaker(speaker.id,{heightM:clamp(+e.target.value||1,1,roomHeight)})}/></label>
        <label>DOWN ANGLE (°)<input type="number" min="-10" max="45" step=".5" value={speaker.downAngleDeg} onChange={e=>updateSpeaker(speaker.id,{downAngleDeg:clamp(+e.target.value||0,-10,45)})}/></label>
        <label>VENDOR SENSITIVITY<input readOnly value={sensitivity(speaker).toFixed(1)+" dB @ 2.83V/1m"}/></label>
      </div>
      <small className="cbt-source-note">{info.note} <a href={info.source} target="_blank" rel="noreferrer">Manufacturer spec</a></small>
    </article>;})}</div>
    <button disabled={speakers.length>=3} onClick={addSpeaker}><Plus/> Add CBT speaker {speakers.length>=3?"(max 3)":""}</button>
    <div className="cbt-section"><div className="heading"><Ruler/><h3>Audience planes · up to 4 independent sections</h3></div>
      <div className="table-wrap"><table><thead><tr><th>Plane</th><th>Distance from speaker (m)</th><th>Ear height (m)</th></tr></thead><tbody>{planes.map(plane=><tr key={plane.id}><td><input className="cbt-table-input" value={plane.name} onChange={e=>updatePlane(plane.id,{name:e.target.value})}/></td><td><input className="cbt-table-input" type="number" min=".5" max={roomDepth} step=".1" value={plane.distanceM} onChange={e=>updatePlane(plane.id,{distanceM:clamp(+e.target.value||.5,.5,roomDepth)})}/></td><td><input className="cbt-table-input" type="number" min=".5" max="2" step=".05" value={plane.earHeightM} onChange={e=>updatePlane(plane.id,{earHeightM:clamp(+e.target.value||1,.5,2)})}/></td></tr>)}</tbody></table></div>
    </div>
    <div className="cbt-section"><div className="heading"><Activity/><h3>Six listening locations · SPL summary</h3></div>
      <div className="table-wrap"><table><thead><tr><th>Listener</th><th>Plane</th><th>Offset (m)</th><th>Distance</th><th>Coverage</th><th>Combined SPL</th><th>Target</th></tr></thead><tbody>{predictions.map(p=><tr key={p.listener.id}><td><input className="cbt-table-input" value={p.listener.name} onChange={e=>setListeners(old=>old.map(x=>x.id===p.listener.id?{...x,name:e.target.value}:x))}/></td><td><select className="cbt-table-select" value={p.listener.planeId} onChange={e=>setListeners(old=>old.map(x=>x.id===p.listener.id?{...x,planeId:+e.target.value}:x))}>{planes.map(plane=><option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></td><td><input className="cbt-table-input short" type="number" step=".1" value={p.listener.offsetM} onChange={e=>setListeners(old=>old.map(x=>x.id===p.listener.id?{...x,offsetM:clamp(+e.target.value||0,-2,2)}:x))}/></td><td>{p.distanceM.toFixed(1)} m</td><td><b className={p.covered?"coherence-good":"coherence-low"}>{p.covered?"IN BEAM":"OFF AXIS"}</b></td><td><b>{p.combined===null?"—":p.combined.toFixed(1)+" dB"}</b></td><td>{p.combined===null?"—":p.combined>=targetSpl?"PASS":"LOW"}</td></tr>)}</tbody></table></div>
      <div className="cbt-level-summary"><span>Predicted range <b>{minLevel===null?"—":minLevel.toFixed(1)+" – "+(maxLevel as number).toFixed(1)+" dB SPL"}</b></span><span>Listener points below target <b>{predictions.filter(p=>p.combined!==null&&p.combined<targetSpl).length}/{predictions.length}</b></span></div>
    </div>
    <div className="cbt-section"><div className="heading"><Ruler/><h3>Vertical coverage cross-section · schematic</h3></div>
      <div className="cbt-plot"><svg viewBox="0 0 760 340" role="img" aria-label="Vertical coverage of CBT speaker arrays in room side section">
        {[0,1,2,3,4,5,6,7].filter(v=>v<=roomHeight).map(v=><g key={"h"+v}><line x1="55" x2="735" y1={yFor(v)} y2={yFor(v)} stroke="#29414b" strokeDasharray="3 5"/><text x="42" y={yFor(v)+4} textAnchor="end" fill="#8098a4" fontSize="10">{v}m</text></g>)}
        <line x1="55" y1={yFor(0)} x2="735" y2={yFor(0)} stroke="#6c8b93" strokeWidth="2"/>
        <line x1="55" y1={yFor(roomHeight)} x2="735" y2={yFor(roomHeight)} stroke="#516a76" strokeDasharray="5 5"/>
        {speakers.map((speaker,index)=>{const half=coverage(speaker)/2,center=speaker.downAngleDeg;const startX=xFor(0.8),startY=yFor(speaker.heightM);const upper=rayEnd(speaker,center-half),lower=rayEnd(speaker,center+half);return <g key={speaker.id}><path d={"M "+startX+" "+startY+" L "+upper.x+" "+upper.y+" L "+lower.x+" "+lower.y+" Z"} fill={COLORS[index]} fillOpacity=".08" stroke={COLORS[index]} strokeOpacity=".45" strokeWidth="1.3"/><line x1={startX} y1={startY} x2={lower.x} y2={lower.y} stroke={COLORS[index]} strokeWidth="1.6" strokeDasharray="5 4"/><rect x={startX-5} y={startY-12} width="10" height="24" rx="3" fill={COLORS[index]}/><text x={startX+12} y={startY-14} fill={COLORS[index]} fontSize="11">{speaker.name}</text></g>;})}
        {planes.map(plane=><g key={plane.id}><line x1={xFor(plane.distanceM)} y1={yFor(0)} x2={xFor(plane.distanceM)} y2={yFor(roomHeight)} stroke="#b8c8ce" strokeOpacity=".5" strokeDasharray="3 4"/><circle cx={xFor(plane.distanceM)} cy={yFor(plane.earHeightM)} r="4" fill="#f3c275"/><text x={xFor(plane.distanceM)+5} y={yFor(plane.earHeightM)-8} fill="#e8cc9e" fontSize="9">{plane.name}</text></g>)}
        <text x="58" y="18" fill="#91a9b2" fontSize="10">MẶT CẮT DỌC · COVERAGE ±3 dB APPROXIMATION</text><text x="735" y="326" textAnchor="end" fill="#91a9b2" fontSize="10">ROOM DEPTH {roomDepth} m</text>
      </svg></div>
    </div>
    <p className="warning">Đây là CBT planner hình học, không phải thuật toán JBL CBT Calculator. SPL sử dụng sensitivity trung bình của tài liệu hãng, truyền âm trường tự do và cộng công suất không pha; beam được xấp xỉ đối xứng, -6 dB tại nửa góc phủ. Chưa mô phỏng directivity theo tần số, vertical asymmetry thật của CBT70, shading/delay network, phase/lobing, phản xạ phòng, hấp thụ, noise criteria hay frequency response. Không dùng làm kết quả nghiệm thu; với dự án thực, đối chiếu CBT Calculator chính hãng hoặc GLL/CLF đã xác minh.</p>
  </section>;
}
