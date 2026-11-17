export type DspEvidenceGrade =
  | "manufacturer-documentation"
  | "community-protocol-reference"
  | "user-supplied-image";
export type DspCategory = "mixer" | "processor";
export type DspProfile = {
  id: string;
  name: string;
  family: string;
  category: DspCategory;
  models: string[];
  controlStatus: "manual-only";
  transport: string;
  evidenceGrade: DspEvidenceGrade;
  documentationUrl: string;
  integrationNote: string;
  validationNeeded: string;
};

export const dspProfiles: DspProfile[] = [
  {
    id: "behringer-x32-midas-m32",
    name: "Behringer X32 / Midas M32",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["Behringer X32", "X32 Compact", "X32 Producer", "X32 Rack", "X32 Core", "Midas M32", "M32R Live", "M32C"],
    controlStatus: "manual-only",
    transport: "Ethernet · tài liệu OSC tương thích X32/M32 của cộng đồng; thường tham chiếu UDP 10023",
    evidenceGrade: "community-protocol-reference",
    documentationUrl: "https://static.makemusic.tn/manuals/Consoles/Behringer/Behringer%20-%20X32%20OSC%20Unofficial.pdf",
    integrationNote: "Tài liệu cộng đồng mô tả giao thức OSC cho X32/M32. Ứng dụng chưa gửi OSC; cần xác minh model, firmware, địa chỉ tham số và phản hồi trên bàn mixer thật.",
    validationNeeded: "Không dùng giao thức của X32/M32 cho WING hoặc X-Air theo suy đoán. Trước khi bật điều khiển cần kiểm tra truy vấn chỉ đọc, xác nhận ghi, giới hạn tốc độ, kết nối lại và rollback trên đúng firmware.",
  },
  {
    id: "soundcraft-ui",
    name: "Soundcraft Ui Series",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["Ui12", "Ui16", "Ui24R"],
    controlStatus: "manual-only",
    transport: "Wi-Fi tích hợp / Ethernet · giao diện điều khiển HTML5 của hãng",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://www.soundcraft.com/en-US/get-started/ui-series",
    integrationNote: "Tài liệu hãng mô tả điều khiển bằng trình duyệt HTML5 qua mạng. Đây là giao diện điều khiển của mixer, không phải API DSP chung do ứng dụng này triển khai.",
    validationNeeded: "Xác minh đúng model Ui, firmware, xác thực/session và quy tắc truy cập trình duyệt. Không tự động nhúng hay gửi lệnh vào giao diện web.",
  },
  {
    id: "soundcraft-si-vi",
    name: "Soundcraft Si / Vi Series",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["Si Compact", "Si Expression 1", "Si Expression 2", "Si Expression 3", "Si Performer 1", "Si Performer 2", "Si Performer 3", "Si Impact", "Vi1", "Vi1000", "Vi2000", "Vi3000", "Vi400/600", "Vi5000", "Vi7000"],
    controlStatus: "manual-only",
    transport: "Ethernet · hệ sinh thái HiQnet / ViSi Remote; khác với Ui browser control",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://www.soundcraft.com/en-US/products/visi-remote.html",
    integrationNote: "Danh mục đã tách các model Si và Vi. ViSi Remote/HiQnet là hệ sinh thái riêng, không dùng chung adapter của Ui hoặc OSC X32.",
    validationNeeded: "Đối chiếu bảng tương thích theo firmware/console và phần mềm hãng. Chưa có adapter HiQnet/ViSi Remote trong ứng dụng.",
  },
  {
    id: "yamaha-tf-series",
    name: "Yamaha TF Series",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["TF5", "TF3", "TF1", "TF-RACK"],
    controlStatus: "manual-only",
    transport: "Mạng Ethernet/Wi-Fi qua hệ sinh thái TF Editor / TF StageMix; chưa có adapter bên thứ ba",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://vn.yamaha.com/vi/audio/portable-pa/products/mixers/tf/",
    integrationNote: "Các model TF5, TF3, TF1 và TF-RACK được đưa vào danh mục cấu hình. Ứng dụng chỉ lưu sơ đồ kênh và phiếu kỹ thuật; không tự nhận quyền điều khiển mixer.",
    validationNeeded: "Đối chiếu phiên bản firmware, phiên bản TF Editor/StageMix và topology mạng. Chỉ triển khai API sau khi có giao thức chính thức và kiểm thử với thiết bị thật.",
  },
  {
    id: "yamaha-dm3-series",
    name: "Yamaha DM3 Series",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["DM3", "DM3S"],
    controlStatus: "manual-only",
    transport: "Ethernet · OSC; USB · MIDI theo tài liệu dòng DM3",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://vn.yamaha.com/vi/business/audio/products/mixers/dm3/",
    integrationNote: "Tài liệu Yamaha mô tả hỗ trợ OSC qua Ethernet và MIDI qua USB ở dòng DM3. Danh mục này không có nghĩa ứng dụng đã mở socket OSC hoặc gửi MIDI.",
    validationNeeded: "Xác minh model DM3/DM3S, firmware, nhóm OSC được hỗ trợ, quyền truy cập và phản hồi. Bản hiện tại chưa có bộ chuyển tiếp USB MIDI/OSC và không gửi lệnh.",
  },
  {
    id: "yamaha-cl-ql-series",
    name: "Yamaha CL / QL Series",
    family: "Mixer kỹ thuật số",
    category: "mixer",
    models: ["CL5", "CL3", "CL1", "QL5", "QL1"],
    controlStatus: "manual-only",
    transport: "Ethernet / Dante · hệ sinh thái điều khiển Yamaha theo dòng máy",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://usa.yamaha.com/business/audio/products/mixers/cl-series/specs.html",
    integrationNote: "Danh mục CL/QL được tách khỏi TF và DM3 vì khác thế hệ/luồng điều khiển. Dùng để lập sơ đồ hệ thống và ghi nhận thiết bị, chưa kết nối trực tiếp.",
    validationNeeded: "Kiểm tra chính xác CL/QL model, firmware, Dante card và phần mềm điều khiển tương ứng. Không áp dụng cấu hình OSC của DM3 sang CL/QL.",
  },
  {
    id: "dbx-driverack-pa2",
    name: "dbx DriveRack PA2",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["DriveRack PA2"],
    controlStatus: "manual-only",
    transport: "Wi-Fi · ứng dụng điều khiển chính thức PA2; không có API bên thứ ba xác minh",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/products/driverack-pa2",
    integrationNote: "dbx công bố ứng dụng PA2 Control. Không suy luận rằng ứng dụng ngoài có thể gửi lệnh qua cùng giao diện.",
    validationNeeded: "Cần xác nhận firmware, quy trình kết nối và giao diện tích hợp được hãng cho phép. Hiện chỉ dùng phiếu cấu hình thủ công.",
  },
  {
    id: "dbx-driverack-venu360",
    name: "dbx DriveRack VENU360",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["VENU360", "VENU360-B", "VENU360-D"],
    controlStatus: "manual-only",
    transport: "Ethernet · ứng dụng VENU360 Control; các biến thể cần xác minh riêng",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en/product_documents/dbx_driverack_venu360_manual-pdf",
    integrationNote: "Tài liệu hãng mô tả kết nối Ethernet và ứng dụng điều khiển dành riêng. Các biến thể -B/-D cần đối chiếu tài liệu và phần cứng cụ thể.",
    validationNeeded: "Không dùng cổng hoặc giao thức của PA2 hay DriveRack 260 cho VENU360. Cần xác minh giao thức mạng, xác thực và read-back cho từng phiên bản.",
  },
  {
    id: "dbx-driverack-260",
    name: "dbx DriveRack 260",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["DriveRack 260"],
    controlStatus: "manual-only",
    transport: "USB / RS-232 · tài liệu sản phẩm dbx",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa",
    integrationNote: "dbx liệt kê DriveRack 260 với đường điều khiển USB/RS-232. Đây là thông tin transport, không phải đặc tả lệnh hoặc hỗ trợ serial của ứng dụng.",
    validationNeeded: "Cần lấy đúng tài liệu DriveRack 260, kiểm tra COM/USB driver và giao thức trước khi viết adapter. Không dùng protocol khác trong dòng DriveRack.",
  },
  {
    id: "dbx-driverack-4800-4820",
    name: "dbx DriveRack 4800 / 4820",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["DriveRack 4800", "DriveRack 4820"],
    controlStatus: "manual-only",
    transport: "Ethernet · HiQnet",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/products/driverack-4820/features",
    integrationNote: "Tài liệu dbx liệt kê điều khiển mạng HiQnet cho dòng 4800/4820. Đây không phải giao thức OSC công khai.",
    validationNeeded: "Cần đặc tả HiQnet chính xác, phần mềm thiết bị và kiểm thử read-back, xác nhận ghi, reconnect và rollback với từng model.",
  },
  {
    id: "dbx-driverack-legacy",
    name: "dbx DriveRack Legacy / Discontinued",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["DriveRack PA", "DriveRack PA+", "DriveRack PX", "DriveRack 220i", "DriveRack Studio", "DriveRack Premium (China)"],
    controlStatus: "manual-only",
    transport: "USB / RS-232 / Ethernet hoặc ứng dụng hãng tùy model; không dùng chung một giao thức",
    evidenceGrade: "manufacturer-documentation",
    documentationUrl: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa",
    integrationNote: "Thư viện liệt kê thêm các model DriveRack cũ và khu vực đặc thù để kỹ thuật viên nhận diện. Các model khác nhau về transport và trạng thái hỗ trợ.",
    validationNeeded: "Chọn đúng model trước khi đối chiếu manual/firmware. Không áp dụng cấu hình, port hoặc protocol của PA2/VENU360 cho thiết bị legacy.",
  },
  {
    id: "db-acoustics-cd48",
    name: "db Acoustics CD48",
    family: "Bộ xử lý quản lý loa",
    category: "processor",
    models: ["CD48", "CD48RTS", "CD48 Premium"],
    controlStatus: "manual-only",
    transport: "Theo revision: USB Serial / Ethernet RJ45 trên một số phiên bản; cần đối chiếu nhãn và firmware",
    evidenceGrade: "user-supplied-image",
    documentationUrl: "https://dbacoustic.vn/crossover-dbacoustic-cd48",
    integrationNote: "Ảnh tham chiếu đã gửi cho thấy một cấu hình CD48 có RJ45 100M Ethernet, LCD hiển thị IP 192.168.20.20 và Ver 2215, cùng USB COM2. Không suy luận CD48RTS/Premium có cùng phần cứng hoặc giao thức.",
    validationNeeded: "Xác minh đúng CD48/CD48RTS/CD48 Premium, firmware, cổng và IP trên máy thật. Hướng dẫn USB COM chỉ mô tả bước kết nối phần mềm PC; chưa công bố baud rate, frame, command hay login payload cho Android. Chưa có adapter USB/LAN thực thi.",
  },
];

export function getDspProfile(id: string): DspProfile | undefined {
  return dspProfiles.find((profile) => profile.id === id);
}
