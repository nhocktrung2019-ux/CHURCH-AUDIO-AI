import{Activity,AudioWaveform,Mic,Radio,Volume2,Waves,RefreshCw,Square,ShieldAlert,Timer,Layers3}from"lucide-react";
import{useAudioAnalyzer}from"./audio/useAudioAnalyzer";
import{useToneGenerator}from"./audio/useToneGenerator";
import{equipment}from"./data/equipment";
import MeasurementPlanner from "./audio/MeasurementPlanner";
import TransferFunctionPanel from "./audio/TransferFunctionPanel";
import FeedbackMonitor from "./audio/FeedbackMonitor";

export default function App(){
 const a=useAudioAnalyzer(),t=useToneGenerator(),inputs=a.devices.filter(d=>d.kind==="audioinput"),outputs=a.devices.filter(d=>d.kind==="audiooutput");
 return <main className="shell">
  <header><div className="brand"><AudioWaveform/><div><b>CHURCH AUDIO</b><small>ANALYZER · SYSTEM TUNING</small></div></div><span className={a.running?"live":"idle"}>{a.running?"● ĐANG ĐO":"● SẴN SÀNG"}</span></header>
  <section className="hero"><small>ACOUSTIC MEASUREMENT WORKSPACE</small><h1>Âm thanh nhà thờ,<br/><em>đo lường rõ ràng.</em></h1><p>Phân tích phổ trực tiếp, phổ thời gian, waterfall và ước tính suy giảm âm học từ microphone.</p></section>
  <section className="metrics"><article><small>INPUT PEAK</small><strong>{a.level<=-99?"−∞":a.level.toFixed(0)} <small>dBFS</small></strong><div className="meter"><i style={{width:Math.max(0,Math.min(100,(a.level+60)/60*100))+"%"}}/></div></article><article><small>INPUT DEVICES</small><strong>{inputs.length} <small>MIC</small></strong></article><article><small>OUTPUT DEVICES</small><strong>{outputs.length} <small>OUT</small></strong></article></section>
  <section className="grid">
   <article className="panel"><div className="heading"><Activity/><h2>RTA · Phân tích phổ</h2><span>{a.running?"LIVE":"WAITING"}</span></div><div className="chart">{a.spectrum.map((v,i)=><i key={i} style={{height:Math.max(2,(v+100)*.98)+"%"}}/>)}</div><div className="axis"><span>20 Hz</span><span>100 Hz</span><span>1 kHz</span><span>5 kHz</span><span>20 kHz</span></div><small className="muted">FFT 8192 · LOG DISPLAY · RELATIVE dBFS</small></article>
   <article className="panel"><div className="heading"><Radio/><h2>Thiết bị âm thanh</h2></div><label>MICROPHONE INPUT</label><select value={a.selectedInput} onChange={e=>a.setSelectedInput(e.target.value)}><option value="">Mặc định hệ thống</option>{inputs.map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||"Microphone"}</option>)}</select><label>OUTPUT DEVICES (phát theo mặc định hệ thống)</label><select disabled><option>Đầu ra mặc định của trình duyệt</option>{outputs.map(d=><option key={d.deviceId}>{d.label}</option>)}</select><button onClick={()=>a.running?a.stop():void a.start()}>{a.running?<Square/>:<Mic/>}{a.running?"Dừng đo":"Bắt đầu đo microphone"}</button><button className="secondary" onClick={()=>void a.refreshDevices()}><RefreshCw/> Làm mới thiết bị</button>{a.error&&<p className="error"><ShieldAlert/>{a.error}</p>}</article>
   <article className="panel"><div className="heading"><Timer/><h2>RT60 · Suy giảm âm</h2></div><strong className="rt-value">{a.rt60===null?"—":a.rt60.toFixed(2)+" s"}</strong><p className="muted">Ước tính Schroeder từ bản ghi microphone 6 giây; cần xung/sweep rõ và nền ồn thấp.</p><button disabled={!a.running||a.capturingRt60} onClick={()=>void a.captureRt60()}>{a.capturingRt60?"Đang ghi mẫu 6 giây…":"Ghi mẫu và ước tính RT60"}</button><p className="warning">Đây là ước tính hiện trường, không thay thế phép đo đáp ứng xung chuẩn IEC/ISO. Phát tín hiệu thử ở mức an toàn.</p></article>
   <article className="panel"><div className="heading"><Layers3/><h2>Spectrogram · Waterfall</h2><span>{a.history.length} FRAMES</span></div><div className="spectrogram">{a.history.slice(-24).map((row,i)=><div className="spectro-row" key={i}>{row.map((v,j)=><i key={j} style={{opacity:Math.max(.08,Math.min(1,(v+100)/100))}}/>)}</div>)}</div><small className="muted">Trục ngang: tần số log · Trục dọc: thời gian · Màu sáng: mức tương đối</small></article>
   <article className="panel"><div className="heading"><Waves/><h2>Signal Generator</h2></div><div className="value"><label>Tần số</label><b>{t.frequency.toLocaleString("vi-VN")} Hz</b></div><input type="range" min="20" max="20000" step="10" value={t.frequency} onChange={e=>t.setFrequency(+e.target.value)}/><div className="value"><label>Mức phát</label><b>{t.volume} dB</b></div><input type="range" min="-60" max="0" value={t.volume} onChange={e=>t.setVolume(+e.target.value)}/><button onClick={()=>t.active?t.stop():void t.start()}><Volume2/>{t.active?"Dừng tín hiệu":"Phát tín hiệu thử"}</button><p className="warning">Bắt đầu ở mức thấp, giảm âm lượng ampli trước khi thử.</p></article>
   <article className="panel"><div className="heading"><Volume2/><h2>Thư viện thiết bị</h2><span>{equipment.length} ITEMS</span></div>{equipment.map(x=><div className="item" key={x.name}><b>{x.name}</b><small>{x.type} · Cần xác minh thông số hãng</small></div>)}</article>
  </section>
  <MeasurementPlanner running={a.running} spectrum={a.spectrum}/>
  <TransferFunctionPanel selectedInput={a.selectedInput}/>
  <FeedbackMonitor history={a.history}/>
  <section className="roadmap"><small>ROADMAP</small><p>01 RTA + SPECTROGRAM <b>→</b> 02 RT60 / DELAY <b>→</b> 03 AUTO EQ / FEEDBACK <b>→</b> 04 3D COVERAGE <b>→</b> 05 DSP CONTROL</p></section>
  <footer>CHURCH AUDIO ANALYZER <span>BUILD 0.6.0 · FEEDBACK WATCH</span></footer>
 </main>;
}