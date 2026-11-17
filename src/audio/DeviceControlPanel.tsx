import { useMemo, useState } from "react";
import { Cable, Copy, Download, ExternalLink, ShieldAlert, SlidersHorizontal, Wifi } from "lucide-react";

type ProtocolKind = "osc" | "ui-web" | "dbx-app" | "zonepro" | "hiqnet" | "serial-pending";
type Manufacturer = "dBacoustics" | "Behringer" | "Midas" | "dbx" | "Soundcraft";
type DeviceProfile = {
  id: string;
  manufacturer: Manufacturer;
  model: string;
  family: string;
  protocol: ProtocolKind;
  transport: string;
  status: string;
  detail: string;
  capabilities: string[];
  port?: number;
  docs: string;
};

const profiles: DeviceProfile[] = [
  { id: "cd48", manufacturer: "dBacoustics", model: "CD48", family: "DSP 4 In / 8 Out", protocol: "serial-pending", transport: "USB · LAN RJ45 · RS232", status: "Chờ xác minh lệnh điều khiển", detail: "Hồ sơ phần cứng CD48. Có các đường điều khiển USB, RJ45 và RS232; chưa có command set/baud rate chính thức được xác minh trong ứng dụng nên không tự gửi dữ liệu.", capabilities: ["Input/output routing", "PEQ / GEQ", "Crossover", "Delay", "Phase", "Gate / Compressor / Limiter", "128 scenes"], docs: "https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/" },
  { id: "cd48-premium", manufacturer: "dBacoustics", model: "CD48 Premium", family: "DSP 4 In / 8 Out", protocol: "serial-pending", transport: "USB · LAN RJ45 · RS232", status: "Chờ xác minh lệnh điều khiển", detail: "Biến thể Premium được mô tả cùng nền tảng CD48; cần xác nhận firmware và phiên bản phần mềm trước khi dùng chung profile giao tiếp.", capabilities: ["Input/output routing", "11-band PEQ", "Crossover", "Delay up to 2000 ms", "Phase", "Gate / Compressor / Limiter", "128 scenes"], docs: "https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/" },
  { id: "cd4008rts", manufacturer: "dBacoustics", model: "CD4008RTS", family: "DSP 4 In / 8 Out", protocol: "serial-pending", transport: "Manufacturer software / interface to verify", status: "Cần xác minh model & firmware", detail: "Thiết bị DSP liên quan nhưng không được mặc định dùng chung protocol với CD48. Cần tài liệu đúng model.", capabilities: ["DSP routing", "EQ / crossover", "FIR support (verify firmware)", "Preset workflow"], docs: "https://cdn.audioplus.com.vn/san-pham/thiet-bi-xu-ly-tin-hieu-crossover-dbacoustic-cd48-premium/" },

  { id: "x32", manufacturer: "Behringer", model: "X32", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC được tài liệu hóa · mới xem trước lệnh", detail: "X32 OSC dùng Ethernet UDP port 10023; ứng dụng này mới tạo command preview, chưa mở UDP socket/native bridge.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview", "EQ / routing profile planned"], port: 10023, docs: "https://behringer.com/en/products/0603-AAB" },
  { id: "x32-compact", manufacturer: "Behringer", model: "X32 Compact", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC được tài liệu hóa · mới xem trước lệnh", detail: "Dùng profile OSC thuộc họ X32; kiểm tra firmware và mapping kênh thực tế trước khi viết tham số.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview"], port: 10023, docs: "https://behringer.com/en/products/0603-AAB" },
  { id: "x32-producer", manufacturer: "Behringer", model: "X32 Producer", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC được tài liệu hóa · mới xem trước lệnh", detail: "Dùng profile OSC thuộc họ X32; mapping cần kiểm tra lại theo console/firmware.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },
  { id: "x32-rack", manufacturer: "Behringer", model: "X32 Rack", family: "Rack digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC được tài liệu hóa · mới xem trước lệnh", detail: "Dùng họ OSC X32/M32; cần xác nhận routing và channel bank trên Rack.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },
  { id: "x32-core", manufacturer: "Behringer", model: "X32 CORE", family: "Rack / core mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "Profile OSC họ X32 · xác minh firmware", detail: "Model thế hệ trước; cần xác minh phiên bản phần mềm và trạng thái thiết bị trước khi kết nối.", capabilities: ["OSC command preview", "State query preview"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },

  { id: "m32", manufacturer: "Midas", model: "M32", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC được tài liệu hóa · mới xem trước lệnh", detail: "M32 tương thích họ OSC với X32 trên UDP port 10023; ứng dụng chưa có live transport.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview"], port: 10023, docs: "https://www.midasconsoles.com/" },
  { id: "m32r", manufacturer: "Midas", model: "M32R Live", family: "Compact digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC họ M32 · mới xem trước lệnh", detail: "Dùng họ OSC M32; cần xác minh mapping mixer và firmware trước khi bật ghi tham số.", capabilities: ["Channel gain / mute preview", "Mixer state query preview", "OSC subscription preview"], port: 10023, docs: "https://www.midasconsoles.com/" },
  { id: "m32c", manufacturer: "Midas", model: "M32C", family: "Rack / core mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC họ M32 · mới xem trước lệnh", detail: "Dùng họ OSC M32; kiểm tra stagebox/routing và firmware thực tế.", capabilities: ["OSC command preview", "State query preview"], port: 10023, docs: "https://www.midasconsoles.com/" },

  { id: "dbx-pa2", manufacturer: "dbx", model: "DriveRack PA2", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · PA2 Control App", status: "Ứng dụng hãng có sẵn · API riêng chưa xác minh", detail: "dbx phát hành PA2 Control App riêng. Chưa giả lập hoặc tự suy ra giao thức điều khiển của ứng dụng hãng.", capabilities: ["Preset workflow", "Processing parameters via vendor app", "Device setup"], docs: "https://dbxpro.com/en-US/products/driverack-pa2" },
  { id: "dbx-venu360", manufacturer: "dbx", model: "DriveRack VENU360", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · VENU360 Control App", status: "Ứng dụng hãng có sẵn · API riêng chưa xác minh", detail: "Tài liệu dbx xác nhận ứng dụng điều khiển có thể chỉnh phần lớn chức năng mặt máy, RTA, tham số xử lý và preset; chưa có API bên thứ ba được triển khai ở đây.", capabilities: ["Processing parameters via vendor app", "RTA / preset workflow", "Tuning database"], docs: "https://dbxpro.com/en-US/support_downloads/products/driverack-venu360" },
  { id: "dbx-venu360d", manufacturer: "dbx", model: "DriveRack VENU360-D", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · model-specific software", status: "Model riêng · cần kiểm tra firmware", detail: "Không tự động dùng profile VENU360 thường cho VENU360-D khi chưa xác nhận firmware và tài liệu model.", capabilities: ["Model-specific setup", "Preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/driverack-venu360-d" },
  { id: "dbx-260", manufacturer: "dbx", model: "DriveRack 260", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "DriveWare · model connection to verify", status: "DriveWare được hãng liệt kê · chưa tích hợp", detail: "dbx liệt kê DriveWare cho DriveRack 260; cách kết nối và lệnh điều khiển chưa được triển khai trong app.", capabilities: ["DriveWare workflow", "Preset / processing setup via vendor software"], docs: "https://dbxpro.com/en-US/products/driverack-260" },
  { id: "dbx-pa", manufacturer: "dbx", model: "DriveRack PA", family: "Legacy loudspeaker processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Model cũ nằm trong danh mục DriveRack discontinued; không dùng profile PA2 cho model này.", capabilities: ["Model-specific setup", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-pa-plus", manufacturer: "dbx", model: "DriveRack PA+", family: "Legacy loudspeaker processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Model discontinued; cần đúng tài liệu và phần mềm phiên bản cũ.", capabilities: ["Model-specific setup", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-px", manufacturer: "dbx", model: "DriveRack PX", family: "Legacy loudspeaker processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Không giả định tương thích giao thức với PA2/VENU360.", capabilities: ["Model-specific setup", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-studio", manufacturer: "dbx", model: "DriveRack Studio", family: "Legacy loudspeaker processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Model discontinued; cần xác nhận đúng software và cổng giao tiếp.", capabilities: ["Model-specific setup", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-220i", manufacturer: "dbx", model: "DriveRack 220i", family: "Legacy install processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Cần xác minh tài liệu thiết lập và firmware riêng.", capabilities: ["Install DSP profile", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-4800", manufacturer: "dbx", model: "DriveRack 4800", family: "Legacy install processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Không dùng lệnh của DriveRack 260 hoặc VENU360 cho 4800.", capabilities: ["Install DSP profile", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-4820", manufacturer: "dbx", model: "DriveRack 4820", family: "Legacy install processor", protocol: "dbx-app", transport: "Legacy vendor software · exact connection to verify", status: "Legacy model · driver/protocol needs validation", detail: "Cần protocol và software đúng dòng 4820.", capabilities: ["Install DSP profile", "Processing / preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-venu360b", manufacturer: "dbx", model: "DriveRack VENU360-B", family: "Legacy loudspeaker processor", protocol: "dbx-app", transport: "Model-specific vendor software", status: "Legacy model · firmware compatibility pending", detail: "Biến thể VENU360-B nằm trong danh mục discontinued; không tự động gộp firmware hoặc profile với VENU360 tiêu chuẩn.", capabilities: ["Model-specific setup", "Preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/dbx-driverack-pa" },
  { id: "dbx-zone-640", manufacturer: "dbx", model: "ZonePRO 640", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "dbx công bố ZonePRO Protocol Guide; cần chọn đúng model/firmware và kiểm thử read-before-write trước khi kích hoạt điều khiển.", capabilities: ["Zone control profile", "Protocol guide available", "Read/write integration pending"], docs: "https://dbxpro.com/en-US/support_downloads/download_types/3rdpartyresource" },
  { id: "dbx-zone-640m", manufacturer: "dbx", model: "ZonePRO 640m", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần xác minh profile 640m riêng; không suy diễn toàn bộ mapping từ 640.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-641", manufacturer: "dbx", model: "ZonePRO 641", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần kiểm tra model/firmware và mapping I/O trước khi ghi.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-641m", manufacturer: "dbx", model: "ZonePRO 641m", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần profile 641m riêng, không dùng mapping của 641 khi chưa xác nhận.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-1260", manufacturer: "dbx", model: "ZonePRO 1260", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần kiểm tra đúng phiên bản phần cứng và firmware.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-1260m", manufacturer: "dbx", model: "ZonePRO 1260m", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần profile 1260m riêng và xác minh trạng thái trước khi ghi.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-1261", manufacturer: "dbx", model: "ZonePRO 1261", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần kiểm tra mapping I/O đúng model.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },
  { id: "dbx-zone-1261m", manufacturer: "dbx", model: "ZonePRO 1261m", family: "Zone processor", protocol: "zonepro", transport: "Model-specific network / serial integration", status: "Có ZonePRO Protocol Guide · driver chưa tích hợp", detail: "Cần profile 1261m riêng và thử nghiệm trên thiết bị an toàn.", capabilities: ["Zone control profile", "Protocol guide available", "Driver pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/1260" },

  { id: "ui12", manufacturer: "Soundcraft", model: "Ui12", family: "Browser-controlled digital mixer", protocol: "ui-web", transport: "Wi-Fi / Ethernet · embedded web UI", status: "Điều khiển bằng trình duyệt được xác nhận", detail: "Hòa mạng Wi-Fi của mixer rồi mở địa chỉ IP của mixer; mặc định hotspot thường dùng 10.10.1.1 hoặc ui.io. Đây là web console của Soundcraft, không phải API của Church Audio.", capabilities: ["Open mixer web console", "Mixing / EQ / dynamics through vendor UI"], docs: "https://www.soundcraft.com/en-US/get-started/ui-series" },
  { id: "ui16", manufacturer: "Soundcraft", model: "Ui16", family: "Browser-controlled digital mixer", protocol: "ui-web", transport: "Wi-Fi / Ethernet · embedded web UI", status: "Điều khiển bằng trình duyệt được xác nhận", detail: "Mở giao diện web tích hợp của mixer qua mạng LAN/Wi-Fi.", capabilities: ["Open mixer web console", "Mixing / EQ / dynamics through vendor UI"], docs: "https://www.soundcraft.com/en-US/get-started/ui-series" },
  { id: "ui24r", manufacturer: "Soundcraft", model: "Ui24R", family: "Browser-controlled digital mixer", protocol: "ui-web", transport: "Dual-band Wi-Fi / Ethernet · embedded web UI", status: "Điều khiển bằng trình duyệt được xác nhận", detail: "Có thể điều khiển từ trình duyệt trên Android, Windows, macOS và Linux theo trang sản phẩm Soundcraft.", capabilities: ["Open mixer web console", "Channel EQ / dynamics", "Output GEQ / AFS2 / RTA through vendor UI"], docs: "https://www.soundcraft.com/en-US/products/ui24r/specifications" },
  { id: "si-compact", manufacturer: "Soundcraft", model: "Si Compact", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Soundcraft ViSi Remote hỗ trợ Si Compact và cần router nối HiQnet port; giao tiếp proprietary, không dùng OSC.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-exp1", manufacturer: "Soundcraft", model: "Si Expression 1", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-exp2", manufacturer: "Soundcraft", model: "Si Expression 2", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-exp3", manufacturer: "Soundcraft", model: "Si Expression 3", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-perf1", manufacturer: "Soundcraft", model: "Si Performer 1", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-perf2", manufacturer: "Soundcraft", model: "Si Performer 2", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-perf3", manufacturer: "Soundcraft", model: "Si Performer 3", family: "Digital mixing console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ · API trực tiếp chưa tích hợp", detail: "Có tên trong danh sách console hỗ trợ ViSi Remote.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "si-impact", manufacturer: "Soundcraft", model: "Si Impact", family: "Digital mixing console", protocol: "hiqnet", transport: "Model-specific network control", status: "Cần xác minh tương thích remote", detail: "Được đưa vào danh mục model, nhưng không mặc định gán tương thích ViSi Remote nếu tài liệu model/firmware không xác nhận.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi1", manufacturer: "Soundcraft", model: "Vi1", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ theo tài liệu dòng Vi", detail: "ViSi Remote liệt kê các console Vi; cần xác nhận phiên bản phần mềm console trước khi dùng.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "vi2", manufacturer: "Soundcraft", model: "Vi2", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ theo tài liệu dòng Vi", detail: "ViSi Remote liệt kê các console Vi; cần xác nhận phiên bản phần mềm console trước khi dùng.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "vi4", manufacturer: "Soundcraft", model: "Vi4", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ theo tài liệu dòng Vi", detail: "ViSi Remote liệt kê các console Vi; cần xác nhận phiên bản phần mềm console trước khi dùng.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "vi6", manufacturer: "Soundcraft", model: "Vi6", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet network · ViSi Remote", status: "Remote app hãng hỗ trợ theo tài liệu dòng Vi", detail: "ViSi Remote liệt kê các console Vi; cần xác nhận phiên bản phần mềm console trước khi dùng.", capabilities: ["Remote levels / graphic EQ via ViSi Remote", "Third-party driver pending"], docs: "https://www.soundcraft.com/en-US/products/visi-remote" },
  { id: "vi1000", manufacturer: "Soundcraft", model: "Vi1000", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Cần xác minh tài liệu phần mềm", detail: "Có trong danh mục hỗ trợ/tài liệu Soundcraft; không mặc định lệnh ViSi Remote cũ tương thích.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi2000", manufacturer: "Soundcraft", model: "Vi2000", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Cần xác minh tài liệu phần mềm", detail: "Có trong danh mục hỗ trợ/tài liệu Soundcraft; không mặc định lệnh ViSi Remote cũ tương thích.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi3000", manufacturer: "Soundcraft", model: "Vi3000", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Cần xác minh tài liệu phần mềm", detail: "Có trong danh mục hỗ trợ/tài liệu Soundcraft; không mặc định lệnh ViSi Remote cũ tương thích.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi5000", manufacturer: "Soundcraft", model: "Vi5000", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Cần xác minh tài liệu phần mềm", detail: "Có trong danh mục hỗ trợ/tài liệu Soundcraft; không mặc định lệnh ViSi Remote cũ tương thích.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi7000", manufacturer: "Soundcraft", model: "Vi7000", family: "Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Cần xác minh tài liệu phần mềm", detail: "Có trong danh mục hỗ trợ/tài liệu Soundcraft; không mặc định lệnh ViSi Remote cũ tương thích.", capabilities: ["Model profile", "Control integration pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
];

const manufacturers: Manufacturer[] = ["dBacoustics", "Behringer", "Midas", "dbx", "Soundcraft"];
const getProfile = (id: string) => profiles.find(profile => profile.id === id) ?? profiles[0];

export default function DeviceControlPanel() {
  const [manufacturer, setManufacturer] = useState<Manufacturer>("Behringer");
  const [deviceId, setDeviceId] = useState("x32");
  const [host, setHost] = useState("192.168.1.100");
  const [port, setPort] = useState("10023");
  const [channel, setChannel] = useState("01");
  const [gain, setGain] = useState("0");
  const [mute, setMute] = useState(false);
  const [customModel, setCustomModel] = useState("");
  const availableModels = profiles.filter(profile => profile.manufacturer === manufacturer);
  const selected = getProfile(deviceId);
  const isOsc = selected.protocol === "osc";
  const osc = useMemo(() => [
    { action: "Read channel preamp trim", address: `/ch/${channel}/preamp/trim`, value: "query preview" },
    { action: "Set channel mute", address: `/ch/${channel}/mix/on`, value: mute ? 0 : 1 },
    { action: "Set channel preamp trim", address: `/ch/${channel}/preamp/trim`, value: Number(gain) },
    { action: "Subscribe to console updates", address: "/xremote", value: "subscription preview" },
  ], [channel, gain, mute]);

  const config = {
    schema: "church-audio-device-profile/v2",
    generatedAt: new Date().toISOString(),
    manufacturer: selected.manufacturer,
    model: selected.model,
    customModel: customModel || null,
    family: selected.family,
    connection: { transport: selected.transport, host, port: Number(port) || selected.port || null },
    protocol: selected.protocol,
    protocolStatus: isOsc ? "documented-protocol-preview-only-no-live-transport" : selected.protocol,
    capabilities: selected.capabilities,
    safety: "No network, USB or serial command has been sent. Device state and firmware must be confirmed before enabling writes.",
    oscPreview: isOsc ? osc : [],
    references: [selected.docs],
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `church-audio-${selected.id}-profile.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const copyAddress = async (address: string) => {
    try { await navigator.clipboard.writeText(address); } catch { /* Clipboard may be unavailable in embedded Android WebView. */ }
  };
  const openUiConsole = () => {
    const safeHost = host.trim();
    if (!/^[a-zA-Z0-9.-]+$/.test(safeHost)) return;
    window.open(`http://${safeHost}`, "_blank", "noopener,noreferrer");
  };
  const chooseManufacturer = (next: Manufacturer) => {
    setManufacturer(next);
    const first = profiles.find(profile => profile.manufacturer === next);
    if (first) {
      setDeviceId(first.id);
      setPort(String(first.port ?? ""));
      setHost(first.protocol === "ui-web" ? "10.10.1.1" : "192.168.1.100");
    }
  };
  const chooseDevice = (nextId: string) => {
    const next = getProfile(nextId);
    setDeviceId(nextId);
    setPort(String(next.port ?? ""));
    if (next.protocol === "ui-web") setHost("10.10.1.1");
    else if (next.port) setHost("192.168.1.100");
  };

  return <article className="panel device-control-panel">
    <div className="heading"><Cable /><h2>DSP & Mixer Control</h2><span>{profiles.length} MODEL PROFILES</span></div>
    <p className="muted">Thư viện model đa hãng. Mỗi model có giao thức và trạng thái xác minh riêng; chỉ X32/M32 có bản xem trước OSC trong ứng dụng, Soundcraft Ui có thể mở giao diện mixer trên trình duyệt.</p>
    <div className="device-control-grid">
      <div className="protection-field"><label>HÃNG / MANUFACTURER</label><select value={manufacturer} onChange={event => chooseManufacturer(event.target.value as Manufacturer)}>{manufacturers.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="protection-field"><label>MODEL CỤ THỂ</label><select value={availableModels.some(item => item.id === deviceId) ? deviceId : availableModels[0]?.id ?? ""} onChange={event => chooseDevice(event.target.value)}>{availableModels.map(item => <option key={item.id} value={item.id}>{item.model}</option>)}</select></div>
      <div className="protection-field full"><label>MODEL / FIRMWARE KHÁC (TÙY CHỌN)</label><input value={customModel} onChange={event => setCustomModel(event.target.value)} placeholder="Nhập model hoặc firmware nếu không có trong danh sách" /></div>
      <div className="protection-field"><label>ĐỊA CHỈ IP / HOST</label><input value={host} onChange={event => setHost(event.target.value)} placeholder="192.168.1.100" /></div>
      <div className="protection-field"><label>PORT (NẾU CÓ)</label><input value={port} onChange={event => setPort(event.target.value)} inputMode="numeric" placeholder="Model-specific" /></div>
      {isOsc && <>
        <div className="protection-field"><label>INPUT CHANNEL (01–32)</label><input value={channel} onChange={event => setChannel(event.target.value.replace(/\D/g, "").slice(0, 2).padStart(2, "0"))} inputMode="numeric" /></div>
        <div className="protection-field"><label>PREAMP TRIM PREVIEW (dB)</label><input value={gain} onChange={event => setGain(event.target.value)} inputMode="decimal" /></div>
        <label className="device-mute-toggle"><input type="checkbox" checked={mute} onChange={event => setMute(event.target.checked)} /> Preview trạng thái mute ON</label>
      </>}
    </div>
    <div className={isOsc || selected.protocol === "ui-web" ? "device-protocol-status" : "device-protocol-status pending"}>
      {isOsc || selected.protocol === "ui-web" ? <Wifi /> : <ShieldAlert />}
      <div><b>{selected.status}</b><span>{selected.detail}</span><span><strong>Giao tiếp:</strong> {selected.transport}</span><span><strong>Nhóm:</strong> {selected.family}</span></div>
    </div>
    <section className="osc-preview">
      <div className="protection-subheading"><SlidersHorizontal /><b>CHỨC NĂNG / CAPABILITY PROFILE</b><span>MODEL-SPECIFIC</span></div>
      <div className="device-capability-list">{selected.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div>
      {isOsc && <>
        <div className="protection-subheading"><SlidersHorizontal /><b>OSC COMMAND PREVIEW</b><span>NOT SENT</span></div>
        {osc.map(item => <div className="osc-line" key={item.action}><div><b>{item.action}</b><code>{item.address}</code><small>Value: {String(item.value)}</small></div><button type="button" className="icon-button" aria-label="Copy OSC address" onClick={() => void copyAddress(item.address)}><Copy /></button></div>)}
        <p className="muted">Địa chỉ OSC chỉ để xem trước. Chưa có UDP socket/native bridge, chưa đọc trạng thái mixer và chưa thể ghi thông số thực.</p>
      </>}
      {selected.protocol === "ui-web" && <div className="protection-actions"><button type="button" onClick={openUiConsole}><ExternalLink /> Mở giao diện web mixer</button></div>}
      {(selected.protocol === "dbx-app" || selected.protocol === "hiqnet") && <p className="muted">Sử dụng ứng dụng/tài liệu chính hãng qua liên kết bên dưới. Tích hợp trực tiếp vào Church Audio cần driver hoặc SDK/giao thức đã được hãng xác nhận.</p>}
      <a className="device-doc-link" href={selected.docs} target="_blank" rel="noreferrer">Tài liệu / hỗ trợ chính hãng hoặc nguồn thông số model <ExternalLink /></a>
    </section>
    <div className="protection-actions"><button type="button" onClick={exportConfig}><Download /> Xuất hồ sơ model JSON</button></div>
    <p className="warning protection-warning"><ShieldAlert /> Không có lệnh điều khiển nào được gửi. Trước khi bật ghi tham số cần có kết nối native phù hợp, đọc trạng thái hiện tại, xác nhận model/firmware, hiển thị giá trị trước-sau và yêu cầu người vận hành xác nhận.</p>
  </article>;
}
