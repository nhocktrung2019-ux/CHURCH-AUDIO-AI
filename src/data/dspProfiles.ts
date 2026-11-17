export type DspProfile = {
  id: string; name: string; family: string; controlStatus: "manual-only";
  integrationNote: string; validationNeeded: string;
};
export const dspProfiles: DspProfile[] = [
  { id: "behringer-x32-m32", name: "Behringer X32 / M32", family: "Digital mixer", controlStatus: "manual-only", integrationNote: "Tạo phiếu cấu hình để kỹ thuật viên nhập thủ công trên mixer. Chưa có network bridge hoặc lệnh điều khiển được bật trong ứng dụng.", validationNeeded: "Xác minh model, firmware, quyền mạng, transport, mapping kênh/bus và phản hồi thiết bị trên mixer thật." },
  { id: "soundcraft", name: "Soundcraft (Ui / Si / Vi)", family: "Digital mixer", controlStatus: "manual-only", integrationNote: "Hỗ trợ lưu sơ đồ channel/bus và thông số đề xuất dưới dạng phiếu thao tác thủ công.", validationNeeded: "Phải xác định chính xác dòng mixer và firmware trước khi thiết kế adapter riêng; không dùng một protocol chung cho mọi model." },
  { id: "dbx-driverack", name: "dbx DriveRack", family: "Loudspeaker management DSP", controlStatus: "manual-only", integrationNote: "Xuất ghi chú crossover, HPF, delay và PEQ để nhập thủ công sau khi đo kiểm.", validationNeeded: "Xác minh model DriveRack, routing, crossover, limiter và dải giá trị thực tế theo tài liệu của đúng model." },
  { id: "db-acoustics-cd48", name: "db Acoustics CD48", family: "Loudspeaker management DSP", controlStatus: "manual-only", integrationNote: "Lưu cấu hình dự kiến và checklist commissioning; không gửi lệnh đến thiết bị.", validationNeeded: "Cần tài liệu giao thức, phần mềm hãng, firmware và xác nhận kết nối trên phần cứng CD48 thực tế." },
];
export function getDspProfile(id: string): DspProfile | undefined { return dspProfiles.find((profile) => profile.id === id); }
