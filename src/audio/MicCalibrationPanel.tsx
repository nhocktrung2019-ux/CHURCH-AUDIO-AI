import { useState, type ChangeEvent } from "react";
import { FileUp, Download, Trash2, Activity } from "lucide-react";
import { parseMicCalibration, type MicCalibrationFile } from "./micCalibration";

export default function MicCalibrationPanel({ value, onChange }: { value: MicCalibrationFile | null; onChange: (value: MicCalibrationFile | null) => void }) {
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const importFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    setError("");setNotice("");
    try{
      const parsed=parseMicCalibration(await file.text(),file.name);
      onChange(parsed);
      setNotice("Đã nạp "+parsed.points.length+" điểm hiệu chuẩn; correction được áp dụng theo tần số log.");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Không thể đọc file hiệu chuẩn micro.");
    }
    event.target.value="";
  };
  const downloadTemplate=()=>{
    const text="frequency_hz,correction_db\n20,0.0\n50,0.4\n100,0.2\n250,-0.1\n500,0.0\n1000,0.0\n2000,-0.2\n5000,0.3\n10000,0.5\n20000,0.8\n";
    const url=URL.createObjectURL(new Blob([text],{type:"text/csv"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download="microphone-calibration-template.csv";anchor.click();URL.revokeObjectURL(url);
  };
  const min=value?.points[0]?.frequencyHz,max=value?.points[value.points.length-1]?.frequencyHz;
  return <section className="panel mic-calibration-file-panel">
    <div className="heading"><Activity/><h2>Microphone Frequency Calibration</h2><span>{value?"CURVE ACTIVE":"NO CURVE"}</span></div>
    <p className="muted">Nạp file correction riêng của microphone đo (frequency Hz + correction dB). Đường correction được nội suy theo log-frequency và áp vào RTA / weighted meters / transfer magnitude trước khi gợi ý PEQ.</p>
    <div className="mic-calibration-actions"><label className="polar-upload"><FileUp/> Import mic calibration<input type="file" accept=".txt,.csv,.cal,.dat" onChange={event=>void importFile(event)}/></label><button className="secondary" onClick={downloadTemplate}><Download/> CSV template</button></div>
    {error&&<p className="error">{error}</p>}{notice&&<p className="device-notice">{notice}</p>}
    {value?<><div className="polar-file-info"><b>{value.name}</b><small>{value.points.length} correction points · {min}–{max} Hz · correction dB</small></div><div className="table-wrap"><table><thead><tr><th>Frequency</th><th>Correction applied</th></tr></thead><tbody>{value.points.filter((_,index)=>index%Math.max(1,Math.floor(value.points.length/12))===0).slice(0,12).map(point=><tr key={point.frequencyHz}><td>{point.frequencyHz>=1000?(point.frequencyHz/1000)+" kHz":point.frequencyHz+" Hz"}</td><td>{point.correctionDb>=0?"+":""}{point.correctionDb.toFixed(2)} dB</td></tr>)}</tbody></table></div><button className="secondary" onClick={()=>{onChange(null);setNotice("Đã gỡ correction file; RTA trở về đáp tuyến micro thô.");}}><Trash2/> Remove calibration curve</button></>:<p className="muted">Chưa nạp file. Dùng file calibration do hãng hoặc đơn vị hiệu chuẩn cung cấp; không dùng dữ liệu mẫu template để đo thực tế.</p>}
    <p className="warning">File phải chứa correction cần CỘNG vào kết quả đo (không phải raw microphone response). Hỗ trợ CSV/TXT/Cal dạng hai cột frequency_hz, correction_db. Không thay thế acoustic calibrator 94/114 dB tại 1 kHz, calibration phase, microphone polar response hoặc đo kiểm IEC.</p>
  </section>;
}
