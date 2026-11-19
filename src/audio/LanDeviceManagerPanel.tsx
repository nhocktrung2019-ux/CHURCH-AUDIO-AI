import { useMemo, useState } from "react";
import { Download, Network, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { usePersistentState } from "./usePersistentState";
import { assessLanDevice, type LanDeviceRecord, type LanTransport, type ProtocolEvidence } from "./lanDeviceRegistry";
const blank=():LanDeviceRecord=>({id:String(Date.now()),systemName:"",manufacturer:"",model:"",hardwareRevision:"",firmware:"",transport:"ethernet",deviceIp:"",controllerIp:"",subnetPrefix:24,protocolEvidence:"none",protocolReference:"",physicalLinkChecked:false,sameNetworkChecked:false,vendorSoftwareLoginChecked:false,notes:"",updatedAt:new Date().toISOString()});
function exportRecords(records:LanDeviceRecord[]){const blob=new Blob([JSON.stringify({schema:"church-audio-lan-device-registry/v1",exportedAt:new Date().toISOString(),devices:records,safety:{activeNetworkProbe:false,packetTransmission:false,hardwareWrites:false}},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="church-audio-lan-devices.json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
export default function LanDeviceManagerPanel(){
 const [records,setRecords]=usePersistentState<LanDeviceRecord[]>("church-audio-lan-device-registry-v1",[]);
 const [selectedId,setSelectedId]=useState("");
 const active=records.find(r=>r.id===selectedId)??records[0]??null;
 const readiness=useMemo(()=>active?assessLanDevice(active):null,[active]);
 const update=(patch:Partial<LanDeviceRecord>)=>{if(!active)return;setRecords(old=>old.map(r=>r.id===active.id?{...r,...patch,updatedAt:new Date().toISOString()}:r));};
 const add=()=>{const item=blank();setRecords(old=>[...old,item]);setSelectedId(item.id);};
 const remove=()=>{if(!active)return;setRecords(old=>old.filter(r=>r.id!==active.id));setSelectedId("");};
 const field=(label:string,key:keyof LanDeviceRecord,placeholder="")=><label>{label}<input value={String(active?.[key]??"")} placeholder={placeholder} onChange={e=>update({[key]:e.target.value} as Partial<LanDeviceRecord>)}/></label>;
 return <article className="panel lan-device-manager">
  <div className="heading"><Network/><h2>v0.99 · LAN Device Registry & Readiness</h2><span>READ-ONLY</span></div>
  <p className="muted">Quản lý nhiều Mixer/DSP trong cùng hệ thống, kiểm tra thông tin IP và checklist kết nối. Ứng dụng chưa ping, quét subnet, dò port, đăng nhập hoặc gửi gói tin đến thiết bị.</p>
  <div className="form-grid">
   <div><label>CHỌN THIẾT BỊ</label><select value={active?.id??""} onChange={e=>setSelectedId(e.target.value)}><option value="">Chưa có thiết bị</option>{records.map(r=><option key={r.id} value={r.id}>{r.systemName||r.model||"Thiết bị mới"} · {r.deviceIp||"Chưa có IP"}</option>)}</select></div>
   <div className="button-row"><button type="button" onClick={add}><Plus/> Thêm Mixer/DSP</button><button type="button" className="secondary" disabled={!active} onClick={()=>exportRecords(records)}><Download/> Xuất danh sách</button><button type="button" className="secondary" disabled={!active} onClick={remove}><Trash2/> Xóa mục</button></div>
  </div>
  {active&&<>
   <div className="form-grid">
    {field("TÊN HỆ THỐNG / VỊ TRÍ","systemName","Main Hall / Khu vực 1")}
    {field("HÃNG SẢN XUẤT","manufacturer","db Acoustics")}
    {field("MODEL CHÍNH XÁC","model","CD48")}
    {field("PHIÊN BẢN PHẦN CỨNG / REVISION","hardwareRevision","Ghi theo nhãn thiết bị")}
    {field("FIRMWARE","firmware","Ghi theo màn hình thiết bị")}
    {field("IP THIẾT BỊ DSP","deviceIp","192.168.20.20")}
    {field("IP ĐIỆN THOẠI / MÁY TÍNH","controllerIp","192.168.20.10")}
    <label>SUBNET PREFIX<select value={String(active.subnetPrefix)} onChange={e=>update({subnetPrefix:Number(e.target.value)})}>{[24,23,22,16,25,26,27,28,29,30].map(n=><option key={n} value={n}>/{n}</option>)}</select></label>
    <label>ĐƯỜNG KẾT NỐI<select value={active.transport} onChange={e=>update({transport:e.target.value as LanTransport})}><option value="ethernet">Ethernet trực tiếp / switch</option><option value="wifi-lan">DSP Ethernet + điện thoại Wi-Fi LAN</option><option value="usb-ethernet">USB-C Ethernet adapter</option></select></label>
    <label>BẰNG CHỨNG GIAO THỨC<select value={active.protocolEvidence} onChange={e=>update({protocolEvidence:e.target.value as ProtocolEvidence})}><option value="none">Chưa có tài liệu xác minh</option><option value="vendor-documentation">Tài liệu nhà sản xuất</option><option value="vendor-confirmed">Nhà sản xuất xác nhận đúng revision/firmware</option></select></label>
    {field("LINK TÀI LIỆU / MÃ TÀI LIỆU GIAO THỨC","protocolReference","URL tài liệu hãng hoặc mã tài liệu")}
    <label className="full-width">GHI CHÚ KỸ THUẬT<textarea value={active.notes} onChange={e=>update({notes:e.target.value})} rows={2}/></label>
   </div>
   <div className="measurement-evidence-list">
    <label><input type="checkbox" checked={active.physicalLinkChecked} onChange={e=>update({physicalLinkChecked:e.target.checked})}/><span>Đã kiểm tra dây mạng, cổng RJ45, router/switch hoặc kết nối Wi-Fi thực tế</span></label>
    <label><input type="checkbox" checked={active.sameNetworkChecked} onChange={e=>update({sameNetworkChecked:e.target.checked})}/><span>Đã xác minh điện thoại/máy tính và DSP cùng mạng/VLAN, không bật Guest/AP isolation</span></label>
    <label><input type="checkbox" checked={active.vendorSoftwareLoginChecked} onChange={e=>update({vendorSoftwareLoginChecked:e.target.checked})}/><span>Đã đăng nhập thành công bằng phần mềm chính hãng trên đúng thiết bị (ghi nhận thủ công)</span></label>
   </div>
   <div className="readiness-item limited"><b>TRẠNG THÁI: {readiness?.status==="vendor-workflow-ready"?"ĐỦ ĐIỀU KIỆN CHUYỂN SANG KIỂM THỬ ADAPTER HÃNG":readiness?.status==="protocol-unverified"?"CHƯA XÁC MINH GIAO THỨC":readiness?.status==="different-subnet"?"KHÁC SUBNET":readiness?.status==="address-invalid"?"IP KHÔNG HỢP LỆ":readiness?.status==="incomplete"?"THIẾU THÔNG TIN":"CẦN KIỂM TRA THỦ CÔNG"}</b><p>{readiness?.messages.length?readiness.messages.join(" "):"Checklist đã đủ. Đây vẫn chưa phải trạng thái thiết bị online; chỉ có thể lập kế hoạch kiểm thử read-only với giao thức đã xác minh."}</p></div>
   <p className="warning">Ngay cả khi checklist đầy đủ, ứng dụng không tự xác nhận thiết bị online. Chưa triển khai ping/port scan hoặc kết nối protocol vì mỗi model có cơ chế riêng. Không suy đoán TCP/UDP port, lệnh OSC, mật khẩu hay framing.</p>
  </>}
  {!active&&<p className="muted">Chưa có thiết bị. Nhấn “Thêm Mixer/DSP” để tạo hồ sơ kết nối.</p>}
  <p className="muted"><ShieldCheck/> SAFE MODE · Không đọc/ghi tham số phần cứng, không thay đổi Gain, EQ, Delay, Mute, Phantom, Limiter hoặc routing.</p>
 </article>;
}
