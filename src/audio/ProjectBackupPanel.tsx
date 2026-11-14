import { useState, type ChangeEvent } from "react";
import { Archive, Download, FileUp, RefreshCw } from "lucide-react";

const PREFIX="church-audio-";
function collectProject(){
  const data:Record<string,string>={};
  for(let i=0;i<window.localStorage.length;i++){
    const key=window.localStorage.key(i);
    if(key?.startsWith(PREFIX)){
      const value=window.localStorage.getItem(key);
      if(value!==null)data[key]=value;
    }
  }
  return data;
}
export default function ProjectBackupPanel(){
  const [count,setCount]=useState(()=>{try{return Object.keys(collectProject()).length;}catch{return 0;}});
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const exportProject=()=>{
    setError("");setMessage("");
    try{
      const data=collectProject();
      if(!Object.keys(data).length)throw new Error("Chưa có dữ liệu dự án được lưu.");
      const payload={format:"Church Audio Project",schemaVersion:1,exportedAt:new Date().toISOString(),data};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");anchor.href=url;anchor.download="church-audio-project-backup.json";anchor.click();
      URL.revokeObjectURL(url);
      setCount(Object.keys(data).length);setMessage("Đã xuất "+Object.keys(data).length+" mục dữ liệu dự án.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Không thể xuất dự án.");}
  };
  const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];if(!file)return;
    setError("");setMessage("");
    try{
      const payload=JSON.parse(await file.text()) as {format?:string;schemaVersion?:number;data?:Record<string,unknown>};
      if(payload.format!=="Church Audio Project"||payload.schemaVersion!==1||!payload.data||typeof payload.data!=="object")throw new Error("File không đúng định dạng backup Church Audio Project.");
      const entries=Object.entries(payload.data).filter(([key,value])=>key.startsWith(PREFIX)&&typeof value==="string");
      if(!entries.length)throw new Error("Backup không có dữ liệu dự án hợp lệ.");
      for(const [key,value] of entries)window.localStorage.setItem(key,value as string);
      setCount(Object.keys(collectProject()).length);
      setMessage("Đã nạp "+entries.length+" mục. Ứng dụng đang tải lại để áp dụng dự án…");
      window.setTimeout(()=>window.location.reload(),250);
    }catch(cause){setError(cause instanceof Error?cause.message:"Không thể nhập backup.");}
    event.target.value="";
  };
  return <section className="panel project-backup-panel">
    <div className="heading"><Archive/><h2>Project Manager · Backup / Restore</h2><span>LOCAL PROJECT</span></div>
    <div className="project-backup-stats"><article><small>SAVED SETTINGS / MEASUREMENTS</small><b>{count} items</b></article><article><small>STORAGE MODE</small><b>On-device · local</b></article></div>
    <p className="muted">Lưu và khôi phục cấu hình phòng, vị trí loa, CBT layout, polar data, microphone calibration, Transfer Function A/B và các điểm khảo sát đã lưu trên thiết bị này.</p>
    <div className="project-backup-actions"><button onClick={exportProject}><Download/> Export project JSON</button><label className="polar-upload"><FileUp/> Import project backup<input type="file" accept=".json,application/json" onChange={event=>void importProject(event)}/></label><button className="secondary" onClick={()=>setCount(Object.keys(collectProject()).length)}><RefreshCw/> Refresh saved count</button></div>
    {message&&<p className="device-notice">{message}</p>}{error&&<p className="error">{error}</p>}
    <p className="warning">Backup là bản sao JSON được lưu/download thủ công. Dữ liệu lưu cục bộ trong trình duyệt/Android app; xóa dữ liệu ứng dụng hoặc gỡ cài đặt có thể làm mất bản đang lưu. Hãy export backup trước khi cài lại hoặc chuyển thiết bị. Không có dữ liệu âm thanh thô trong backup.</p>
  </section>;
}
