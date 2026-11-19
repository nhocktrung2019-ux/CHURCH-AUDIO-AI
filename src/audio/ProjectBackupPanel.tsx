import { useState, type ChangeEvent } from "react";
import { Archive, Download, FileUp, RefreshCw, ShieldCheck } from "lucide-react";
import { PROJECT_BACKUP_FORMAT, PROJECT_BACKUP_SCHEMA_VERSION, PROJECT_BACKUP_PREFIX, PROJECT_BACKUP_MAX_BYTES, createProjectBackupChecksum, validateProjectBackup, verifyProjectBackupChecksum } from "./projectBackupValidation";
function collectProject(){const data:Record<string,string>={};for(let i=0;i<window.localStorage.length;i++){const key=window.localStorage.key(i);if(key?.startsWith(PROJECT_BACKUP_PREFIX)){const value=window.localStorage.getItem(key);if(value!==null)data[key]=value;}}return data;}
export default function ProjectBackupPanel(){
 const [count,setCount]=useState(()=>{try{return Object.keys(collectProject()).length;}catch{return 0;}});
 const [message,setMessage]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const exportProject=async()=>{setError("");setMessage("");setBusy(true);try{
  const data=collectProject();if(!Object.keys(data).length)throw new Error("Chưa có dữ liệu dự án được lưu.");
  const payload={format:PROJECT_BACKUP_FORMAT,schemaVersion:PROJECT_BACKUP_SCHEMA_VERSION,exportedAt:new Date().toISOString(),data,checksum:await createProjectBackupChecksum(data)};
  const serialized=JSON.stringify(payload,null,2);if(new TextEncoder().encode(serialized).byteLength>PROJECT_BACKUP_MAX_BYTES)throw new Error("Dữ liệu dự án vượt giới hạn backup 20 MB.");
  const url=URL.createObjectURL(new Blob([serialized],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="church-audio-project-backup-v2.json";anchor.click();URL.revokeObjectURL(url);
  setCount(Object.keys(data).length);setMessage("Đã xuất "+Object.keys(data).length+" mục · SHA-256 checksum.");
 }catch(cause){setError(cause instanceof Error?cause.message:"Không thể xuất dự án.");}finally{setBusy(false);}};
 const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;setError("");setMessage("");setBusy(true);try{
  if(file.size>PROJECT_BACKUP_MAX_BYTES)throw new Error("File backup vượt giới hạn 20 MB.");
  const payload:unknown=JSON.parse(await file.text());const validation=validateProjectBackup(payload);if(!validation.valid)throw new Error(validation.reason);
  if(validation.schemaVersion===2&&!(await verifyProjectBackupChecksum(payload)))throw new Error("SHA-256 không khớp. File có thể đã hỏng hoặc bị thay đổi; không khôi phục dữ liệu.");
  const integrity=validation.integrity==="sha256"?"SHA-256 đã xác minh":"backup v1 cũ (không có checksum)";
  const date=validation.exportedAt?new Date(validation.exportedAt).toLocaleString():"không rõ";
  if(!window.confirm(`Khôi phục ${validation.entries.length} mục dữ liệu (xuất lúc ${date})? Trạng thái: ${integrity}. Các khóa cùng tên hiện có sẽ bị ghi đè. Hãy xuất backup hiện tại trước.`)){setMessage("Đã hủy khôi phục; dữ liệu hiện tại không thay đổi.");return;}
  const previous=new Map<string,string|null>();for(const [key] of validation.entries)previous.set(key,window.localStorage.getItem(key));
  try{for(const [key,value] of validation.entries)window.localStorage.setItem(key,value);}catch(writeError){for(const [key,old] of previous){try{if(old===null)window.localStorage.removeItem(key);else window.localStorage.setItem(key,old);}catch{/* best effort rollback */}}throw writeError;}
  setCount(Object.keys(collectProject()).length);setMessage("Đã khôi phục "+validation.entries.length+" mục ("+integrity+"). Đang tải lại…");window.setTimeout(()=>window.location.reload(),400);
 }catch(cause){setError(cause instanceof Error?cause.message:"Không thể nhập backup.");}finally{setBusy(false);event.target.value="";}};
 return <section className="panel project-backup-panel">
  <div className="heading"><Archive/><h2>Project Manager · Backup / Restore</h2><span>LOCAL PROJECT</span></div>
  <div className="project-backup-stats"><article><small>SAVED SETTINGS / MEASUREMENTS</small><b>{count} items</b></article><article><small>STORAGE MODE</small><b>On-device · local</b></article></div>
  <p className="muted">Lưu và khôi phục cấu hình phòng, vị trí loa, CBT layout, polar data, microphone calibration, Transfer Function A/B và các điểm khảo sát đã lưu trên thiết bị này.</p>
  <div className="project-backup-actions"><button disabled={busy} onClick={()=>void exportProject()}><Download/> Export project JSON · v2</button><label className="polar-upload"><FileUp/> Import project backup<input type="file" accept=".json,application/json" disabled={busy} onChange={event=>void importProject(event)}/></label><button className="secondary" disabled={busy} onClick={()=>setCount(Object.keys(collectProject()).length)}><RefreshCw/> Refresh saved count</button></div>
  {message&&<p className="device-notice"><ShieldCheck/> {message}</p>}{error&&<p className="error">{error}</p>}
  <p className="warning">v1.01 xuất schema v2 có SHA-256 để phát hiện file bị thay đổi/hỏng. Backup v1.00 vẫn nhập được nhưng được cảnh báo chưa xác minh checksum. SHA-256 không phải chữ ký số và không xác thực người gửi. Giới hạn 20 MB / 2.000 mục / 5 MB mỗi mục; xác nhận trước khi ghi đè và rollback khi có thể. Không xóa khóa khác không nằm trong backup. Hãy giữ bản sao an toàn ngoài thiết bị.</p>
 </section>;
}
