export type LanTransport = "ethernet" | "wifi-lan" | "usb-ethernet";
export type ProtocolEvidence = "none" | "vendor-documentation" | "vendor-confirmed";
export type LanDeviceRecord = {
  id: string; systemName: string; manufacturer: string; model: string; hardwareRevision: string;
  firmware: string; transport: LanTransport; deviceIp: string; controllerIp: string;
  subnetPrefix: number; protocolEvidence: ProtocolEvidence; protocolReference: string;
  physicalLinkChecked: boolean; sameNetworkChecked: boolean; vendorSoftwareLoginChecked: boolean;
  notes: string; updatedAt: string;
};
export type LanReadiness = {
  addressValid: boolean; sameSubnet: boolean; identityComplete: boolean; protocolVerified: boolean;
  physicalLinkChecked: boolean; operatorNetworkCheck: boolean; mayAttemptVendorWorkflow: boolean;
  status: "incomplete"|"address-invalid"|"different-subnet"|"protocol-unverified"|"manual-check-required"|"vendor-workflow-ready";
  messages: string[];
};
export function parseLanIPv4(value:string):number|null {
  const parts=value.trim().split(".");
  if(parts.length!==4)return null;
  let out=0;
  for(const part of parts){if(!/^(0|[1-9]\d{0,2})$/.test(part))return null;const n=Number(part);if(n>255)return null;out=((out<<8)|n)>>>0;}
  return out>>>0;
}
export function sameLanSubnet(a:string,b:string,prefix:number):boolean|null {
  const x=parseLanIPv4(a),y=parseLanIPv4(b);
  if(x===null||y===null||!Number.isInteger(prefix)||prefix<1||prefix>30)return null;
  const mask=(0xffffffff << (32-prefix))>>>0;
  return ((x&mask)>>>0)===((y&mask)>>>0);
}
export function assessLanDevice(record:LanDeviceRecord):LanReadiness {
  const addressValid=parseLanIPv4(record.deviceIp)!==null&&parseLanIPv4(record.controllerIp)!==null&&Number.isInteger(record.subnetPrefix)&&record.subnetPrefix>=1&&record.subnetPrefix<=30;
  const sameSubnet=addressValid&&sameLanSubnet(record.deviceIp,record.controllerIp,record.subnetPrefix)===true;
  const identityComplete=Boolean(record.manufacturer.trim()&&record.model.trim()&&record.hardwareRevision.trim()&&record.firmware.trim());
  const protocolVerified=record.protocolEvidence!=="none"&&record.protocolReference.trim().length>0;
  const messages:string[]=[];
  if(!identityComplete)messages.push("Cần xác minh hãng, model, phiên bản phần cứng và firmware chính xác.");
  if(!addressValid)messages.push("Địa chỉ IPv4 hoặc subnet prefix không hợp lệ.");
  else if(!sameSubnet)messages.push("Điện thoại và thiết bị không cùng subnet theo thông số đã nhập.");
  if(!record.physicalLinkChecked)messages.push("Chưa xác nhận cáp Ethernet, router/switch hoặc kết nối Wi-Fi thực tế.");
  if(!record.sameNetworkChecked)messages.push("Chưa xác minh điện thoại và DSP đang ở cùng mạng/VLAN, không bật AP isolation.");
  if(!protocolVerified)messages.push("Chưa có tài liệu giao thức/phiên bản tương thích được nhà sản xuất xác nhận.");
  else if(record.protocolEvidence==="vendor-documentation")messages.push("Có tài liệu tham chiếu; vẫn cần xác nhận tài liệu đúng firmware và model đang dùng.");
  const mayAttemptVendorWorkflow=identityComplete&&addressValid&&sameSubnet&&record.physicalLinkChecked&&record.sameNetworkChecked&&protocolVerified;
  const status:LanReadiness["status"]=!identityComplete?"incomplete":!addressValid?"address-invalid":!sameSubnet?"different-subnet":!protocolVerified?"protocol-unverified":!record.physicalLinkChecked||!record.sameNetworkChecked?"manual-check-required":"vendor-workflow-ready";
  return {addressValid,sameSubnet,identityComplete,protocolVerified,physicalLinkChecked:record.physicalLinkChecked,operatorNetworkCheck:record.sameNetworkChecked,mayAttemptVendorWorkflow,status,messages};
}
