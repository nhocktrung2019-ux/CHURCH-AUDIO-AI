export const PROJECT_BACKUP_FORMAT = "Church Audio Project";
export const PROJECT_BACKUP_SCHEMA_VERSION = 2;
export const PROJECT_BACKUP_LEGACY_SCHEMA_VERSION = 1;
export const PROJECT_BACKUP_PREFIX = "church-audio-";
export const PROJECT_BACKUP_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_BACKUP_MAX_VALUE_BYTES = 5 * 1024 * 1024;
export const PROJECT_BACKUP_MAX_ENTRIES = 2000;
export type ValidatedProjectBackup = { valid:true; entries:Array<[string,string]>; exportedAt:string|null; totalBytes:number; schemaVersion:1|2; integrity:"sha256"|"legacy-unverified" };
export type InvalidProjectBackup = { valid:false; reason:string };
export type ProjectBackupValidation = ValidatedProjectBackup | InvalidProjectBackup;
export function canonicalProjectBackupData(data:Record<string,string>):string {
 return JSON.stringify(Object.entries(data).sort(([a],[b])=>a.localeCompare(b)));
}
/** Detects accidental changes; this is not a digital signature or sender authentication. */
export async function createProjectBackupChecksum(data:Record<string,string>):Promise<string> {
 if(!globalThis.crypto?.subtle) throw new Error("Thiết bị không hỗ trợ SHA-256 Web Crypto trong môi trường hiện tại.");
 const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonicalProjectBackupData(data)));
 return "sha256:"+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
export async function verifyProjectBackupChecksum(input:unknown):Promise<boolean> {
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const payload=input as Record<string,unknown>;
 if(payload.schemaVersion!==2||typeof payload.checksum!=="string"||!payload.data||typeof payload.data!=="object"||Array.isArray(payload.data))return false;
 const data=payload.data as Record<string,unknown>;
 if(Object.values(data).some(v=>typeof v!=="string"))return false;
 try{return await createProjectBackupChecksum(data as Record<string,string>)===payload.checksum;}catch{return false;}
}
export function validateProjectBackup(input:unknown):ProjectBackupValidation {
 if(!input||typeof input!=="object"||Array.isArray(input))return {valid:false,reason:"Nội dung backup phải là một JSON object."};
 const payload=input as Record<string,unknown>;
 if(payload.format!==PROJECT_BACKUP_FORMAT||(payload.schemaVersion!==2&&payload.schemaVersion!==1))return {valid:false,reason:"Sai định dạng hoặc phiên bản backup Church Audio Project."};
 if(payload.exportedAt!==undefined&&(typeof payload.exportedAt!=="string"||!Number.isFinite(Date.parse(payload.exportedAt))))return {valid:false,reason:"Thời điểm xuất backup không hợp lệ."};
 if(payload.schemaVersion===2&&(typeof payload.checksum!=="string"||!/^sha256:[a-f0-9]{64}$/.test(payload.checksum)))return {valid:false,reason:"Backup v2 thiếu mã SHA-256 hợp lệ."};
 if(!payload.data||typeof payload.data!=="object"||Array.isArray(payload.data))return {valid:false,reason:"Backup không có vùng dữ liệu hợp lệ."};
 const raw=Object.entries(payload.data as Record<string,unknown>);
 if(!raw.length)return {valid:false,reason:"Backup không chứa dữ liệu dự án."};
 if(raw.length>PROJECT_BACKUP_MAX_ENTRIES)return {valid:false,reason:`Backup vượt giới hạn ${PROJECT_BACKUP_MAX_ENTRIES} mục dữ liệu.`};
 const entries:Array<[string,string]>=[];let totalBytes=0;
 for(const [key,value] of raw){
  if(!key.startsWith(PROJECT_BACKUP_PREFIX)||key.length>240)return {valid:false,reason:"Backup chứa khóa ngoài phạm vi dữ liệu Church Audio hoặc khóa quá dài."};
  if(typeof value!=="string")return {valid:false,reason:`Giá trị của khóa ${key} không phải chuỗi hợp lệ.`};
  const bytes=new TextEncoder().encode(value).byteLength;
  if(bytes>PROJECT_BACKUP_MAX_VALUE_BYTES)return {valid:false,reason:`Mục ${key} vượt giới hạn 5 MB.`};
  totalBytes+=new TextEncoder().encode(key).byteLength+bytes;
  if(totalBytes>PROJECT_BACKUP_MAX_BYTES)return {valid:false,reason:"Tổng dữ liệu backup vượt giới hạn 20 MB."};
  entries.push([key,value]);
 }
 return {valid:true,entries,exportedAt:typeof payload.exportedAt==="string"?payload.exportedAt:null,totalBytes,schemaVersion:payload.schemaVersion as 1|2,integrity:payload.schemaVersion===2?"sha256":"legacy-unverified"};
}
