import { useEffect, useMemo, useRef, useState } from "react";
import { isOscUdpAvailable, OscUdp, type OscQueryResult, type OscValue } from "./oscUdp";
import { usePersistentState } from "./usePersistentState";
import { Cable, Copy, Download, ExternalLink, ShieldAlert, SlidersHorizontal, Wifi } from "lucide-react";

type ProtocolKind = "osc" | "ui-web" | "dbx-app" | "zonepro" | "hiqnet" | "serial-pending" | "manual-only";
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

  { id: "x32", manufacturer: "Behringer", model: "X32", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC native Android · truy vấn chỉ đọc", detail: "X32 OSC qua Ethernet UDP 10023; Android hỗ trợ đọc trạng thái theo từng lô, theo dõi định kỳ và lưu snapshot. Chưa bật lệnh ghi mixer.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export", "Write control pending"], port: 10023, docs: "https://behringer.com/en/products/0603-AAB" },
  { id: "x32-compact", manufacturer: "Behringer", model: "X32 Compact", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC native Android · truy vấn chỉ đọc", detail: "Dùng profile đọc OSC thuộc họ X32; xác minh firmware và mapping thực tế trước khi bật lệnh ghi.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://behringer.com/en/products/0603-AAB" },
  { id: "x32-producer", manufacturer: "Behringer", model: "X32 Producer", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC native Android · truy vấn chỉ đọc", detail: "Dùng profile đọc OSC thuộc họ X32; mapping cần kiểm tra lại theo console/firmware.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },
  { id: "x32-rack", manufacturer: "Behringer", model: "X32 Rack", family: "Rack digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC native Android · truy vấn chỉ đọc", detail: "Dùng họ OSC X32/M32; cần xác nhận routing và channel bank trên Rack.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },
  { id: "x32-core", manufacturer: "Behringer", model: "X32 CORE", family: "Rack / core mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "Profile OSC họ X32 · xác minh firmware", detail: "Model thế hệ trước; cần xác minh phiên bản phần mềm và trạng thái thiết bị trước khi kết nối.", capabilities: ["Read mixer state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://behringer.com/en/products?collection_id=x32-series" },

  { id: "m32", manufacturer: "Midas", model: "M32", family: "Digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC native Android · truy vấn chỉ đọc", detail: "M32 tương thích họ OSC X32 trên UDP 10023; Android hỗ trợ đọc trạng thái theo từng lô, theo dõi định kỳ và lưu snapshot. Chưa bật lệnh ghi mixer.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://www.midasconsoles.com/" },
  { id: "m32r", manufacturer: "Midas", model: "M32R Live", family: "Compact digital mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC họ M32 · mới xem trước lệnh", detail: "Dùng profile đọc OSC thuộc họ M32; cần xác minh mapping mixer và firmware trước khi bật ghi tham số.", capabilities: ["Read input/bus/main state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://www.midasconsoles.com/" },
  { id: "m32c", manufacturer: "Midas", model: "M32C", family: "Rack / core mixer", protocol: "osc", transport: "Ethernet · OSC / UDP", status: "OSC họ M32 · mới xem trước lệnh", detail: "Dùng profile đọc OSC thuộc họ M32; kiểm tra stagebox/routing và firmware thực tế.", capabilities: ["Read mixer state", "Live monitor", "Snapshot / JSON export"], port: 10023, docs: "https://www.midasconsoles.com/" },

  { id: "dbx-pa2", manufacturer: "dbx", model: "DriveRack PA2", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · PA2 Control App", status: "Ứng dụng hãng có sẵn · API riêng chưa xác minh", detail: "dbx phát hành PA2 Control App riêng. Chưa giả lập hoặc tự suy ra giao thức điều khiển của ứng dụng hãng.", capabilities: ["Preset workflow", "Processing parameters via vendor app", "Device setup"], docs: "https://dbxpro.com/en-US/products/driverack-pa2" },
  { id: "dbx-venu360", manufacturer: "dbx", model: "DriveRack VENU360", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · VENU360 Control App", status: "Ứng dụng hãng có sẵn · API riêng chưa xác minh", detail: "Tài liệu dbx xác nhận ứng dụng điều khiển có thể chỉnh phần lớn chức năng mặt máy, RTA, tham số xử lý và preset; chưa có API bên thứ ba được triển khai ở đây.", capabilities: ["Processing parameters via vendor app", "RTA / preset workflow", "Tuning database"], docs: "https://dbxpro.com/en-US/support_downloads/products/driverack-venu360" },
  { id: "dbx-venu360d", manufacturer: "dbx", model: "DriveRack VENU360-D", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "Network · model-specific software", status: "Model riêng · cần kiểm tra firmware", detail: "Không tự động dùng profile VENU360 thường cho VENU360-D khi chưa xác nhận firmware và tài liệu model.", capabilities: ["Model-specific setup", "Preset workflow pending"], docs: "https://dbxpro.com/en-US/support_downloads/products/driverack-venu360-d" },
  { id: "dbx-260", manufacturer: "dbx", model: "DriveRack 260", family: "Loudspeaker management processor", protocol: "dbx-app", transport: "DriveWare · model connection to verify", status: "DriveWare được hãng liệt kê · chưa tích hợp", detail: "dbx liệt kê DriveWare cho DriveRack 260; cách kết nối và lệnh điều khiển chưa được triển khai trong app.", capabilities: ["DriveWare workflow", "Preset / processing setup via vendor software"], docs: "https://dbxpro.com/en-US/products/driverack-260" },
  { id: "dbx-cx2400", manufacturer: "dbx", model: "CX2400", family: "CX loudspeaker control system", protocol: "dbx-app", transport: "Model-specific control system", status: "Model listed · software/protocol verification pending", detail: "CX series control system được dbx liệt kê; cần xác minh đúng biến thể và tài liệu khu vực trước tích hợp.", capabilities: ["System profile", "Control driver pending"], docs: "https://dbxpro.com/en-US/softwares" },
  { id: "dbx-cx3600", manufacturer: "dbx", model: "CX3600", family: "CX loudspeaker control system", protocol: "dbx-app", transport: "Model-specific control system", status: "Model listed · software/protocol verification pending", detail: "Cần xác nhận phiên bản/firmware và giao thức riêng.", capabilities: ["System profile", "Control driver pending"], docs: "https://dbxpro.com/en-US/softwares" },
  { id: "dbx-cx4800", manufacturer: "dbx", model: "CX4800", family: "CX loudspeaker control system", protocol: "dbx-app", transport: "Model-specific control system", status: "Model listed · software/protocol verification pending", detail: "Cần xác nhận phiên bản/firmware và giao thức riêng.", capabilities: ["System profile", "Control driver pending"], docs: "https://dbxpro.com/en-US/softwares" },
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

  { id: "signature-plus-12", manufacturer: "Soundcraft", model: "Signature Plus 12", family: "Analog connected mixer", protocol: "manual-only", transport: "Analog audio · no remote control profile", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog; có thể dùng trong sơ đồ hệ thống và lưu hồ sơ, nhưng không có giao thức điều khiển tham số mạng được xác minh.", capabilities: ["Equipment inventory", "Measurement workflow", "No remote EQ / mute API documented"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "signature-plus-16", manufacturer: "Soundcraft", model: "Signature Plus 16", family: "Analog connected mixer", protocol: "manual-only", transport: "Analog audio · no remote control profile", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog; cấu hình điều khiển từ xa không được giả định.", capabilities: ["Equipment inventory", "Measurement workflow", "No remote EQ / mute API documented"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "signature-plus-22", manufacturer: "Soundcraft", model: "Signature Plus 22", family: "Analog connected mixer", protocol: "manual-only", transport: "Analog audio · no remote control profile", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog; lưu hồ sơ thiết bị và sơ đồ kết nối, không có điều khiển tham số mạng đã xác minh.", capabilities: ["Equipment inventory", "Measurement workflow", "No remote EQ / mute API documented"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "signature-plus-32", manufacturer: "Soundcraft", model: "Signature Plus 32", family: "Analog connected mixer", protocol: "manual-only", transport: "Analog audio · no remote control profile", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog; không gán tính năng DSP/network control của các mixer Ui/Si/Vi.", capabilities: ["Equipment inventory", "Measurement workflow", "No remote EQ / mute API documented"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "notepad-5", manufacturer: "Soundcraft", model: "Notepad-5", family: "Analog USB mixer", protocol: "manual-only", transport: "Analog audio / USB audio", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer nhỏ gọn analog/USB; USB audio không đồng nghĩa với API điều khiển mixer.", capabilities: ["Equipment inventory", "USB audio input/output workflow", "No remote DSP control"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "notepad-8fx", manufacturer: "Soundcraft", model: "Notepad-8FX", family: "Analog USB mixer", protocol: "manual-only", transport: "Analog audio / USB audio", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog/USB; chỉ nhận diện trong thư viện và hướng dẫn luồng tín hiệu.", capabilities: ["Equipment inventory", "USB audio input/output workflow", "No remote DSP control"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "notepad-12fx", manufacturer: "Soundcraft", model: "Notepad-12FX", family: "Analog USB mixer", protocol: "manual-only", transport: "Analog audio / USB audio", status: "Chỉ nhận diện thiết bị · không có remote DSP control", detail: "Mixer analog/USB; không tự suy diễn rằng kết nối USB cho phép sửa EQ/gain từ app.", capabilities: ["Equipment inventory", "USB audio input/output workflow", "No remote DSP control"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
  { id: "vi400-600", manufacturer: "Soundcraft", model: "Vi400 / Vi600 (upgrade family)", family: "Legacy Vi digital console", protocol: "hiqnet", transport: "HiQnet / model-specific control", status: "Legacy model · cần xác minh phiên bản", detail: "Được phân loại như dòng Vi đời trước; cần firmware và phần cứng cụ thể trước khi kết nối.", capabilities: ["Model profile", "Remote support validation pending"], docs: "https://www.soundcraft.com/en-US/support_downloads/download_types/manual" },
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

type MixerScope = "channels" | "buses" | "main" | "matrices" | "auxin" | "fxrtn" | "dca";
type MixerSnapshot = {
  id: string;
  label: string;
  host: string;
  port: number;
  scope: MixerScope;
  capturedAt: string;
  results: OscQueryResult[];
};

const scopeLabels: Record<MixerScope, string> = {
  channels: "Input channels 01–32",
  buses: "Mix buses 01–16",
  main: "Main Stereo / Mono",
  matrices: "Matrix 01–06",
  auxin: "Aux inputs 01–08",
  fxrtn: "FX returns 01–08",
  dca: "DCA groups 01–08",
};

function makeScopeAddresses(scope: MixerScope): string[] {
  const addresses: string[] = [];
  const add = (base: string, paths: string[]) => paths.forEach(path => addresses.push(base + "/" + path));
  if (scope === "channels") {
    for (let i = 1; i <= 32; i++) {
      const base = "/ch/" + String(i).padStart(2, "0");
      add(base, ["config/name", "mix/fader", "mix/on", "mix/pan", "preamp/trim", "eq/on", "dyn/on"]);
    }
  } else if (scope === "buses") {
    for (let i = 1; i <= 16; i++) {
      const base = "/bus/" + String(i).padStart(2, "0");
      add(base, ["config/name", "mix/fader", "mix/on", "mix/pan", "eq/on", "dyn/on"]);
    }
  } else if (scope === "main") {
    ["/main/st", "/main/m"].forEach(base => add(base, ["config/name", "mix/fader", "mix/on", "eq/on", "dyn/on"]));
  } else if (scope === "matrices") {
    for (let i = 1; i <= 6; i++) add("/mtx/0" + i, ["config/name", "mix/fader", "mix/on", "eq/on", "dyn/on"]);
  } else if (scope === "auxin" || scope === "fxrtn") {
    for (let i = 1; i <= 8; i++) add("/" + scope + "/0" + i, ["config/name", "mix/fader", "mix/on", "mix/pan", "eq/on"]);
  } else {
    for (let i = 1; i <= 8; i++) add("/dca/" + i, ["config/name", "mix/fader", "mix/on"]);
  }
  return addresses;
}

function makeDetailAddresses(scope: MixerScope, strip: string): string[] {
  const n = Number(strip);
  if (!Number.isInteger(n)) return [];
  const padded = String(n).padStart(2, "0");
  const prefix = scope === "channels" ? "/ch/" + padded
    : scope === "buses" ? "/bus/" + padded
    : scope === "matrices" ? "/mtx/" + padded
    : scope === "auxin" ? "/auxin/" + padded
    : scope === "fxrtn" ? "/fxrtn/" + padded
    : scope === "dca" ? "/dca/" + n
    : scope === "main" ? (n === 1 ? "/main/st" : "/main/m")
    : "";
  if (!prefix) return [];
  const paths: string[] = ["config/name", "mix/fader", "mix/on"];
  if (scope === "channels") {
    paths.push("mix/pan", "preamp/trim", "preamp/invert", "gate/on", "gate/thr", "gate/range",
      "dyn/on", "dyn/thr", "dyn/ratio", "dyn/attack", "dyn/hold", "dyn/release", "dyn/mgain", "eq/on");
    for (let band = 1; band <= 4; band++) paths.push("eq/" + band + "/type", "eq/" + band + "/f", "eq/" + band + "/g", "eq/" + band + "/q");
  } else if (scope === "buses" || scope === "matrices" || scope === "main") {
    paths.push("eq/on", "dyn/on", "dyn/thr", "dyn/ratio");
    for (let band = 1; band <= 6; band++) paths.push("eq/" + band + "/type", "eq/" + band + "/f", "eq/" + band + "/g", "eq/" + band + "/q");
  } else if (scope === "auxin" || scope === "fxrtn") {
    paths.push("mix/pan", "eq/on");
    for (let band = 1; band <= 4; band++) paths.push("eq/" + band + "/type", "eq/" + band + "/f", "eq/" + band + "/g", "eq/" + band + "/q");
  }
  return paths.map(path => prefix + "/" + path);
}

function resultStripKey(address: string): string {
  const parts = address.split("/");
  if (parts.length < 4) return "Console";
  if (parts[1] === "main") return "/main/" + parts[2];
  return "/" + parts[1] + "/" + parts[2];
}

function resultFieldKey(address: string): string {
  const parts = address.split("/");
  const tail = parts.slice(parts[1] === "main" ? 3 : 3).join("/");
  if (tail === "config/name") return "name";
  if (tail === "mix/fader") return "fader";
  if (tail === "mix/on") return "on";
  if (tail === "mix/pan") return "pan";
  if (tail === "preamp/trim") return "trim";
  if (tail === "eq/on") return "eq";
  if (tail === "dyn/on") return "dyn";
  return tail;
}

function renderOscValue(value: OscValue | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(3) : "—";
  return value;
}

type GuardedControlMeta = { label: string; unit: string; min: number; max: number; step: number; toggle?: boolean };
function getGuardedControlMeta(parameter: string): GuardedControlMeta {
  if (parameter === "mix/fader") return { label: "Fader level", unit: "dB", min: -90, max: 0, step: 0.1 };
  if (parameter === "mix/on") return { label: "Channel ON / OFF", unit: "0 = mute · 1 = ON", min: 0, max: 1, step: 1, toggle: true };
  if (parameter === "preamp/trim") return { label: "Preamp trim (digital source only)", unit: "dB", min: -18, max: 0, step: 0.25 };
  if (parameter === "preamp/invert" || parameter === "eq/on" || parameter === "delay/on") {
    return { label: parameter === "eq/on" ? "EQ enable" : parameter === "delay/on" ? "Delay enable" : "Preamp polarity", unit: "0 = OFF · 1 = ON", min: 0, max: 1, step: 1, toggle: true };
  }
  if (parameter === "eq/f") return { label: "EQ frequency", unit: "Hz", min: 20, max: 20000, step: 1 };
  if (parameter === "eq/g") return { label: "EQ gain (cut only)", unit: "dB", min: -15, max: 0, step: 0.25 };
  if (parameter === "eq/q") return { label: "EQ Q", unit: "", min: 0.3, max: 10, step: 0.01 };
  if (parameter === "delay/time") return { label: "Channel delay", unit: "ms", min: 0.3, max: 200, step: 0.1 };
  return { label: parameter, unit: "", min: 0, max: 1, step: 0.01 };
}

function controlRawToActual(parameter: string, raw: number): number {
  if (parameter === "mix/fader") {
    if (raw >= 0.5) return raw * 40 - 30;
    if (raw >= 0.25) return raw * 80 - 50;
    if (raw >= 0.0625) return raw * 160 - 70;
    return raw * 480 - 90;
  }
  if (parameter === "preamp/trim") return Math.round((-18 + raw * 36) * 4) / 4;
  if (parameter === "eq/f") return 20 * Math.pow(1000, raw);
  if (parameter === "eq/g") return Math.round((-15 + raw * 30) * 4) / 4;
  if (parameter === "eq/q") return 10 * Math.pow(0.03, raw);
  if (parameter === "delay/time") return Math.round((0.3 + raw * 499.7) * 10) / 10;
  return Math.round(raw);
}

function formatControlRaw(parameter: string, raw: number): string {
  const actual = controlRawToActual(parameter, raw);
  if (parameter === "mix/on" || parameter === "eq/on" || parameter === "delay/on" || parameter === "preamp/invert") {
    return actual >= 0.5 ? "ON" : "OFF";
  }
  if (parameter === "mix/fader") return actual.toFixed(1) + " dB";
  const meta = getGuardedControlMeta(parameter);
  const digits = meta.step >= 1 ? 0 : meta.step >= 0.1 ? 1 : meta.step >= 0.01 ? 2 : 3;
  return actual.toFixed(digits) + (meta.unit ? " " + meta.unit : "");
}

type LastGuardedWrite = {
  host: string;
  port: number;
  address: string;
  parameter: string;
  label: string;
  beforeRawValue: number;
  afterRawValue: number;
  restoreValue: number;
};

export default function DeviceControlPanel() {
  const [manufacturer, setManufacturer] = useState<Manufacturer>("Behringer");
  const [deviceId, setDeviceId] = useState("x32");
  const [host, setHost] = useState("192.168.1.100");
  const [port, setPort] = useState("10023");
  const [customModel, setCustomModel] = useState("");
  const [scope, setScope] = useState<MixerScope>("channels");
  const [selectedStrip, setSelectedStrip] = useState("01");
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryProgress, setQueryProgress] = useState("");
  const [queryError, setQueryError] = useState("");
  const [queryResults, setQueryResults] = useState<OscQueryResult[]>([]);
  const [liveMonitoring, setLiveMonitoring] = useState(false);
  const [writeParameter, setWriteParameter] = useState("mix/fader");
  const [writeBand, setWriteBand] = useState("1");
  const [writeValue, setWriteValue] = useState("-10");
  const [preparedWrite, setPreparedWrite] = useState<null | { address: string; parameter: string; label: string; expectedRawValue: number; currentLabel: string; desiredValue: number }>(null);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [writeMessage, setWriteMessage] = useState("");
  const [lastGuardedWrite, setLastGuardedWrite] = useState<LastGuardedWrite | null>(null);
  const queryBusyRef = useRef(false);
  const [snapshots, setSnapshots] = usePersistentState<MixerSnapshot[]>("church-audio-x32-mixer-snapshots", []);
  const nativeOscAvailable = isOscUdpAvailable();
  const availableModels = profiles.filter(profile => profile.manufacturer === manufacturer);
  const selected = getProfile(deviceId);
  const isOsc = selected.protocol === "osc";
  const validHost = /^[0-9.]+$/.test(host.trim());
  const portNumber = Number(port) || selected.port || 10023;

  const osc = useMemo(() => [
    { action: "Read input channel fader", address: "/ch/" + selectedStrip + "/mix/fader", value: "read-only" },
    { action: "Read input channel mute state", address: "/ch/" + selectedStrip + "/mix/on", value: "read-only" },
    { action: "Read input channel preamp trim", address: "/ch/" + selectedStrip + "/preamp/trim", value: "read-only" },
    { action: "Read input channel EQ state", address: "/ch/" + selectedStrip + "/eq/on", value: "read-only" },
  ], [selectedStrip]);

  const monitorRows = useMemo(() => {
    const grouped = new Map<string, Record<string, OscValue>>();
    for (const item of queryResults) {
      const key = resultStripKey(item.responseAddress || item.requestedAddress);
      const field = resultFieldKey(item.responseAddress || item.requestedAddress);
      const row = grouped.get(key) ?? {};
      row[field] = item.arguments.length > 0 ? item.arguments[0] : null;
      grouped.set(key, row);
    }
    return Array.from(grouped.entries()).map(([id, values]) => ({ id, values })).sort((a, b) => a.id.localeCompare(b.id));
  }, [queryResults]);

  const config = {
    schema: "church-audio-device-profile/v3",
    generatedAt: new Date().toISOString(),
    manufacturer: selected.manufacturer,
    model: selected.model,
    customModel: customModel || null,
    family: selected.family,
    connection: { transport: selected.transport, host, port: portNumber },
    protocol: selected.protocol,
    protocolStatus: isOsc ? "android-native-osc-read-only-query-and-batch" : selected.protocol,
    capabilities: selected.capabilities,
    safety: "Read-only OSC query is enabled for allowlisted X32/M32 paths. No mixer write command is enabled.",
    references: [selected.docs],
  };

  const updateResults = (incoming: OscQueryResult[]) => {
    setQueryResults(current => {
      const values = new Map(current.map(item => [item.requestedAddress, item]));
      incoming.forEach(item => values.set(item.requestedAddress, item));
      return Array.from(values.values()).slice(-700);
    });
  };

  const runBatch = async (addresses: string[], label: string, reset: boolean) => {
    if (!isOsc || !nativeOscAvailable || queryBusyRef.current) return;
    if (!validHost || !Number.isInteger(portNumber) || portNumber < 1024 || portNumber > 65535) {
      setQueryError("Kiểm tra IP LAN và port trước khi truy vấn.");
      return;
    }
    if (reset) setQueryResults([]);
    setQueryBusy(true);
    queryBusyRef.current = true;
    setQueryError("");
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < addresses.length; i += 24) chunks.push(addresses.slice(i, i + 24));
      let received = 0;
      for (let i = 0; i < chunks.length; i++) {
        setQueryProgress(label + " · gói " + (i + 1) + "/" + chunks.length + " · " + received + "/" + addresses.length + " phản hồi");
        const batch = await OscUdp.queryBatch({
          host: host.trim(),
          port: portNumber,
          addresses: chunks[i],
          timeoutMs: 1200,
        });
        received += batch.receivedCount;
        updateResults(batch.results);
      }
      setQueryProgress(label + " · hoàn tất " + received + "/" + addresses.length + " phản hồi");
      if (received < addresses.length) setQueryError("Có " + (addresses.length - received) + " tham số chưa phản hồi. Kiểm tra firmware, đường mạng và thử lại theo từng nhóm.");
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : String(error));
    } finally {
      setQueryBusy(false);
      queryBusyRef.current = false;
    }
  };

  const readScope = () => runBatch(makeScopeAddresses(scope), scopeLabels[scope], true);
  const readSelectedDetail = () => runBatch(makeDetailAddresses(scope, selectedStrip), "Chi tiết " + selectedStrip, false);

  const readConsoleInfo = async () => {
    await runBatch(["/info", "/xinfo", "/status"], "Console identity/status", false);
  };

  const writeMeta = getGuardedControlMeta(writeParameter);
  const writeLeaf = writeParameter.startsWith("eq/") ? writeParameter.split("/")[1] : "";
  const writeAddress = "/ch/" + selectedStrip + "/" + (
    writeParameter.startsWith("eq/") ? "eq/" + writeBand + "/" + writeLeaf : writeParameter
  );

  const prepareGuardedWrite = async () => {
    if (!nativeOscAvailable || !isOsc || scope !== "channels" || liveMonitoring || queryBusyRef.current) return;
    if (writeMeta.toggle && writeValue === "") {
      setWriteMessage("Chọn rõ trạng thái OFF hoặc ON trước khi chuẩn bị lệnh.");
      return;
    }
    const desired = Number(writeValue);
    if (!Number.isFinite(desired) || desired < writeMeta.min || desired > writeMeta.max
      || (writeMeta.step > 0 && Math.abs((desired - writeMeta.min) / writeMeta.step - Math.round((desired - writeMeta.min) / writeMeta.step)) > 0.02)) {
      setWriteMessage("Giá trị không hợp lệ. Giới hạn: " + writeMeta.min + " đến " + writeMeta.max + " " + writeMeta.unit + ".");
      return;
    }
    setWriteBusy(true);
    setWriteMessage("");
    setPreparedWrite(null);
    setWriteConfirm(false);
    queryBusyRef.current = true;
    try {
      const batch = await OscUdp.query({ host: host.trim(), port: portNumber, address: writeAddress, timeoutMs: 1800 });
      const result = batch.results.find(item => item.responseAddress === writeAddress || item.requestedAddress === writeAddress);
      const raw = result?.arguments[0];
      if (typeof raw !== "number" && typeof raw !== "boolean") {
        setWriteMessage("Mixer không trả về giá trị số cho tham số này. Không thể chuẩn bị lệnh ghi.");
        return;
      }
      const rawNumber = typeof raw === "boolean" ? Number(raw) : raw;
      const currentLabel = formatControlRaw(writeParameter, rawNumber);
      const label = getGuardedControlMeta(writeParameter).label;
      setPreparedWrite({ address: writeAddress, parameter: writeParameter, label, expectedRawValue: rawNumber, currentLabel, desiredValue: desired });
      setWriteMessage("Đã đọc giá trị hiện tại. Kiểm tra kỹ strip, IP và giá trị mới trước khi xác nhận.");
    } catch (error) {
      setWriteMessage("Không chuẩn bị được lệnh: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      queryBusyRef.current = false;
      setWriteBusy(false);
    }
  };

  const confirmGuardedWrite = async () => {
    if (!preparedWrite || !writeConfirm || !nativeOscAvailable || queryBusyRef.current) return;
    setWriteBusy(true);
    setWriteMessage("");
    queryBusyRef.current = true;
    try {
      const result = await OscUdp.writeGuarded({
        host: host.trim(),
        port: portNumber,
        address: preparedWrite.address,
        expectedRawValue: preparedWrite.expectedRawValue,
        value: preparedWrite.desiredValue,
        timeoutMs: 1800,
      });
      if (result.verified && typeof result.afterRawValue === "number" && typeof result.beforeRawValue === "number") {
        const restoreValue = controlRawToActual(preparedWrite.parameter, result.beforeRawValue);
        const afterLabel = formatControlRaw(preparedWrite.parameter, result.afterRawValue);
        setLastGuardedWrite({
          host: host.trim(),
          port: portNumber,
          address: preparedWrite.address,
          parameter: preparedWrite.parameter,
          label: preparedWrite.label,
          beforeRawValue: result.beforeRawValue,
          afterRawValue: result.afterRawValue,
          restoreValue,
        });
        setWriteMessage("Đã ghi và đọc lại xác minh thành công: " + afterLabel + ". Giá trị trước đó có thể khôi phục riêng.");
      } else {
        setLastGuardedWrite(null);
        setWriteMessage("Đã gửi gói OSC nhưng chưa xác minh được trạng thái cuối. Kiểm tra mixer trực tiếp; không gửi lặp lại ngay. " + (result.warning ?? ""));
      }
      setPreparedWrite(null);
      setWriteConfirm(false);
    } catch (error) {
      setWriteMessage("Đã hủy hoặc thất bại: " + (error instanceof Error ? error.message : String(error)));
      setPreparedWrite(null);
      setWriteConfirm(false);
    } finally {
      queryBusyRef.current = false;
      setWriteBusy(false);
    }
  };

  const restoreGuardedWrite = async () => {
    if (!lastGuardedWrite || queryBusyRef.current) return;
    const item = lastGuardedWrite;
    const approved = window.confirm(
      "Khôi phục " + item.label + " tại " + item.address + " về " +
      formatControlRaw(item.parameter, item.beforeRawValue) + "? Chỉ khôi phục nếu mixer vẫn đang ở giá trị đã xác minh gần nhất."
    );
    if (!approved) return;
    setWriteBusy(true);
    setWriteMessage("");
    queryBusyRef.current = true;
    try {
      const result = await OscUdp.writeGuarded({
        host: item.host,
        port: item.port,
        address: item.address,
        expectedRawValue: item.afterRawValue,
        value: item.restoreValue,
        timeoutMs: 1800,
      });
      if (result.verified) {
        setLastGuardedWrite(null);
        setWriteMessage("Đã khôi phục và xác minh giá trị trước đó.");
      } else {
        setWriteMessage("Lệnh khôi phục đã gửi nhưng chưa xác minh được. Kiểm tra mixer trực tiếp.");
      }
    } catch (error) {
      setWriteMessage("Không thể khôi phục: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      queryBusyRef.current = false;
      setWriteBusy(false);
    }
  };

  useEffect(() => {
    if (!liveMonitoring || !nativeOscAvailable || !isOsc) return;
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      if (stopped) return;
      if (queryBusyRef.current) {
        timer = window.setTimeout(poll, 500);
        return;
      }
      queryBusyRef.current = true;
      try {
        const base = scope === "channels" ? "/ch/" + selectedStrip
          : scope === "buses" ? "/bus/" + selectedStrip
          : scope === "matrices" ? "/mtx/" + selectedStrip
          : scope === "auxin" ? "/auxin/" + selectedStrip
          : scope === "fxrtn" ? "/fxrtn/" + selectedStrip
          : scope === "dca" ? "/dca/" + Number(selectedStrip)
          : selectedStrip === "02" ? "/main/m" : "/main/st";
        const paths = scope === "channels"
          ? ["mix/fader", "mix/on", "mix/pan", "preamp/trim"]
          : ["mix/fader", "mix/on"];
        const batch = await OscUdp.queryBatch({
          host: host.trim(),
          port: portNumber,
          addresses: paths.map(path => base + "/" + path),
          timeoutMs: 1000,
        });
        if (!stopped) {
          updateResults(batch.results);
          setQueryProgress("Live polling · " + batch.receivedCount + "/" + paths.length + " · 2 giây/lần");
        }
      } catch (error) {
        if (!stopped) setQueryError(error instanceof Error ? error.message : String(error));
      } finally {
        queryBusyRef.current = false;
      }
      if (!stopped) timer = window.setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      queryBusyRef.current = false;
    };
  }, [liveMonitoring, nativeOscAvailable, isOsc, host, portNumber, scope, selectedStrip]);

  const saveSnapshot = () => {
    if (queryResults.length === 0) {
      setQueryError("Chưa có dữ liệu để lưu snapshot.");
      return;
    }
    const snapshot: MixerSnapshot = {
      id: String(Date.now()),
      label: selected.model + " · " + scopeLabels[scope],
      host: host.trim(),
      port: portNumber,
      scope,
      capturedAt: new Date().toISOString(),
      results: queryResults,
    };
    setSnapshots(current => [snapshot, ...current].slice(0, 10));
    setQueryProgress("Đã lưu snapshot tại thiết bị này · " + queryResults.length + " tham số");
  };

  const exportSnapshot = (snapshot?: MixerSnapshot) => {
    const data = snapshot ?? {
      id: String(Date.now()),
      label: selected.model + " · " + scopeLabels[scope],
      host: host.trim(),
      port: portNumber,
      scope,
      capturedAt: new Date().toISOString(),
      results: queryResults,
    };
    const blob = new Blob([JSON.stringify({ schema: "church-audio-mixer-snapshot/v1", ...data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-mixer-snapshot-" + data.id + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "church-audio-" + selected.id + "-profile.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openUiConsole = () => {
    const safeHost = host.trim();
    if (!/^[a-zA-Z0-9.-]+$/.test(safeHost)) return;
    window.open("http://" + safeHost, "_blank", "noopener,noreferrer");
  };

  const chooseManufacturer = (next: Manufacturer) => {
    setManufacturer(next);
    const first = profiles.find(profile => profile.manufacturer === next);
    if (first) {
      setDeviceId(first.id);
      setPort(String(first.port ?? ""));
      setHost(first.protocol === "ui-web" ? "10.10.1.1" : "192.168.1.100");
      setLiveMonitoring(false);
      setPreparedWrite(null);
      setWriteConfirm(false);
      setQueryResults([]);
    }
  };

  const chooseDevice = (nextId: string) => {
    const next = getProfile(nextId);
    setDeviceId(nextId);
    setPort(String(next.port ?? ""));
    if (next.protocol === "ui-web") setHost("10.10.1.1");
    else if (next.port) setHost("192.168.1.100");
    setLiveMonitoring(false);
    setPreparedWrite(null);
    setWriteConfirm(false);
    setQueryResults([]);
  };

  const stripOptions = scope === "channels" ? 32 : scope === "buses" ? 16 : scope === "main" ? 2 : scope === "matrices" ? 6 : 8;
  const tableScopeRows = monitorRows.filter(row => {
    const prefix = scope === "channels" ? "/ch/" : scope === "buses" ? "/bus/" : scope === "main" ? "/main/" : scope === "matrices" ? "/mtx/" : scope === "auxin" ? "/auxin/" : scope === "fxrtn" ? "/fxrtn/" : "/dca/";
    return row.id.startsWith(prefix);
  });

  return <article className="panel device-control-panel">
    <div className="heading"><Cable /><h2>DSP & Mixer Control</h2><span>{profiles.length} MODEL PROFILES</span></div>
    <p className="muted">Thư viện model đa hãng. X32/M32 hỗ trợ đọc trạng thái OSC chỉ đọc trên Android: input, bus, main, matrix, aux, FX return và DCA; dữ liệu được đọc theo từng lô, theo dõi định kỳ và lưu snapshot.</p>
    <div className="device-control-grid">
      <div className="protection-field"><label>HÃNG / MANUFACTURER</label><select value={manufacturer} onChange={event => chooseManufacturer(event.target.value as Manufacturer)}>{manufacturers.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="protection-field"><label>MODEL CỤ THỂ</label><select value={availableModels.some(item => item.id === deviceId) ? deviceId : availableModels[0]?.id ?? ""} onChange={event => chooseDevice(event.target.value)}>{availableModels.map(item => <option key={item.id} value={item.id}>{item.model}</option>)}</select></div>
      <div className="protection-field full"><label>MODEL / FIRMWARE KHÁC (TÙY CHỌN)</label><input value={customModel} onChange={event => setCustomModel(event.target.value)} placeholder="Nhập model hoặc firmware nếu không có trong danh sách" /></div>
      <div className="protection-field"><label>ĐỊA CHỈ IP / HOST</label><input value={host} onChange={event => { setHost(event.target.value); setPreparedWrite(null); setWriteConfirm(false); }} placeholder="192.168.1.100" /></div>
      <div className="protection-field"><label>PORT (NẾU CÓ)</label><input value={port} onChange={event => { setPort(event.target.value); setPreparedWrite(null); setWriteConfirm(false); }} inputMode="numeric" placeholder="10023" /></div>
      {isOsc && <>
        <div className="protection-field"><label>NHÓM DỮ LIỆU</label><select value={scope} onChange={event => { setScope(event.target.value as MixerScope); setLiveMonitoring(false); setPreparedWrite(null); setWriteConfirm(false); }}><option value="channels">Input channels 01–32</option><option value="buses">Mix buses 01–16</option><option value="main">Main Stereo / Mono</option><option value="matrices">Matrix 01–06</option><option value="auxin">Aux inputs 01–08</option><option value="fxrtn">FX returns 01–08</option><option value="dca">DCA groups 01–08</option></select></div>
        <div className="protection-field"><label>STRIP / CHANNEL DETAIL</label><select value={selectedStrip} onChange={event => { setSelectedStrip(event.target.value); setLiveMonitoring(false); setPreparedWrite(null); setWriteConfirm(false); }}>{Array.from({ length: stripOptions }, (_, index) => { const value = String(index + 1).padStart(2, "0"); return <option key={value} value={value}>{scope === "main" ? (index === 0 ? "Main Stereo" : "Main Mono") : value}</option>; })}</select></div>
      </>}
    </div>
    <div className={isOsc || selected.protocol === "ui-web" ? "device-protocol-status" : "device-protocol-status pending"}>
      {isOsc || selected.protocol === "ui-web" ? <Wifi /> : <ShieldAlert />}
      <div><b>{selected.status}</b><span>{selected.detail}</span><span><strong>Giao tiếp:</strong> {selected.transport}</span><span><strong>Nhóm:</strong> {selected.family}</span></div>
    </div>
    <section className="osc-preview">
      <div className="protection-subheading"><SlidersHorizontal /><b>CHỨC NĂNG / CAPABILITY PROFILE</b><span>MODEL-SPECIFIC</span></div>
      <div className="device-capability-list">{selected.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div>
      {isOsc && <section className="osc-live-query">
        <div className="protection-subheading"><Wifi /><b>X32 / M32 NETWORK MONITOR</b><span>READ + GUARDED</span></div>
        <div className="protection-actions">
          <button type="button" disabled={!nativeOscAvailable || queryBusy} onClick={() => void readConsoleInfo()}>Đọc model / firmware</button>
          <button type="button" disabled={!nativeOscAvailable || queryBusy} onClick={() => void readScope()}>Đọc toàn bộ {scopeLabels[scope]}</button>
          <button type="button" className="secondary" disabled={!nativeOscAvailable || queryBusy} onClick={() => void readSelectedDetail()}>Đọc chi tiết strip {selectedStrip}</button>
        </div>
        <div className="protection-actions">
          <button type="button" className={liveMonitoring ? "secondary" : ""} disabled={!nativeOscAvailable || !isOsc} onClick={() => setLiveMonitoring(value => !value)}>{liveMonitoring ? "Dừng Live Monitor" : "Bật Live Monitor · 2 giây"}</button>
          <button type="button" className="secondary" disabled={queryResults.length === 0} onClick={saveSnapshot}>Lưu Snapshot</button>
          <button type="button" className="secondary" disabled={queryResults.length === 0} onClick={() => exportSnapshot()}>Xuất Snapshot JSON</button>
        </div>
        {!nativeOscAvailable && <p className="warning">Cầu nối UDP native chỉ được đóng gói trên Android. Bản web/desktop chưa có native transport.</p>}
        {queryBusy && <p className="muted">Đang truy vấn… {queryProgress}</p>}
        {!queryBusy && queryProgress && <p className="muted">{queryProgress}</p>}
        {queryError && <p className="warning">{queryError}</p>}
        {scope === "channels" && <section className="osc-guarded-write">
          <div className="protection-subheading"><ShieldAlert /><b>GUARDED PARAMETER CONTROL</b><span>READ → CONFIRM → VERIFY</span></div>
          <p className="muted">Chỉ ghi từng tham số input channel 01–32. Ứng dụng đọc trạng thái trước, native plugin đọc lại lần hai ngay trước khi gửi, rồi đọc lại sau khi gửi. EQ gain chỉ cho phép cắt; fader và preamp trim bị giới hạn ở mức không tăng gain.</p>
          <div className="device-control-grid">
            <div className="protection-field">
              <label>THAM SỐ ĐIỀU KHIỂN</label>
              <select value={writeParameter} onChange={event => {
                const next = event.target.value;
                setWriteParameter(next);
                setPreparedWrite(null);
                setWriteConfirm(false);
                const nextMeta = getGuardedControlMeta(next);
                setWriteValue(nextMeta.toggle ? "" : next === "mix/fader" ? "-10" : next === "preamp/trim" ? "-3" : next === "eq/f" ? "1000" : next === "eq/g" ? "-3" : next === "eq/q" ? "1" : next === "delay/time" ? "1" : "1");
              }}>
                <option value="mix/fader">Fader level (dB)</option>
                <option value="mix/on">Channel ON / OFF</option>
                <option value="preamp/trim">Preamp trim (dB · digital input)</option>
                <option value="preamp/invert">Polarity invert</option>
                <option value="eq/on">EQ enable</option>
                <option value="eq/f">EQ frequency (Hz)</option>
                <option value="eq/g">EQ gain (cut only · dB)</option>
                <option value="eq/q">EQ Q</option>
                <option value="delay/on">Delay enable</option>
                <option value="delay/time">Delay time (ms)</option>
              </select>
            </div>
            {writeParameter.startsWith("eq/") && writeParameter !== "eq/on" && <div className="protection-field">
              <label>EQ BAND</label>
              <select value={writeBand} onChange={event => { setWriteBand(event.target.value); setPreparedWrite(null); setWriteConfirm(false); }}>
                <option value="1">Band 1</option><option value="2">Band 2</option><option value="3">Band 3</option><option value="4">Band 4</option>
              </select>
            </div>}
            <div className="protection-field">
              <label>GIÁ TRỊ MỚI · {writeMeta.unit}</label>
              {writeMeta.toggle ? <select value={writeValue} onChange={event => { setWriteValue(event.target.value); setPreparedWrite(null); setWriteConfirm(false); }}>
                <option value="">Chọn OFF / ON</option><option value="0">OFF · 0</option><option value="1">ON · 1</option>
              </select> : <input type="number" min={writeMeta.min} max={writeMeta.max} step={writeMeta.step || "any"} value={writeValue} onChange={event => { setWriteValue(event.target.value); setPreparedWrite(null); setWriteConfirm(false); }} />}
              <small className="muted">Giới hạn cho phép: {writeMeta.min} → {writeMeta.max} {writeMeta.unit}</small>
            </div>
          </div>
          <div className="protection-actions">
            <button type="button" disabled={!nativeOscAvailable || writeBusy || queryBusy || liveMonitoring} onClick={() => void prepareGuardedWrite()}>1. Đọc hiện trạng & chuẩn bị</button>
          </div>
          {preparedWrite && <div className="osc-write-preview">
            <b>{preparedWrite.label} · CH{selectedStrip}</b>
            <div><span>Đang có</span><strong>{preparedWrite.currentLabel}</strong></div>
            <div><span>Yêu cầu mới</span><strong>{preparedWrite.desiredValue} {writeMeta.unit}</strong></div>
            <code>{preparedWrite.address}</code>
            <label className="device-mute-toggle">
              <input type="checkbox" checked={writeConfirm} onChange={event => setWriteConfirm(event.target.checked)} />
              <span>Tôi đã kiểm tra đúng mixer, đúng channel và xác nhận thay đổi tham số trực tiếp trên hệ thống âm thanh.</span>
            </label>
            <button type="button" disabled={!writeConfirm || writeBusy || queryBusy || liveMonitoring} onClick={() => void confirmGuardedWrite()}>2. Xác nhận ghi & đọc lại kiểm tra</button>
          </div>}
          {lastGuardedWrite && <div className="osc-write-preview">
            <b>Thao tác đã xác minh gần nhất</b>
            <div><span>Tham số</span><strong>{lastGuardedWrite.address}</strong></div>
            <div><span>Giá trị trước</span><strong>{formatControlRaw(lastGuardedWrite.parameter, lastGuardedWrite.beforeRawValue)}</strong></div>
            <div><span>Giá trị sau</span><strong>{formatControlRaw(lastGuardedWrite.parameter, lastGuardedWrite.afterRawValue)}</strong></div>
            <button type="button" className="secondary" disabled={writeBusy || queryBusy || liveMonitoring} onClick={() => void restoreGuardedWrite()}>Khôi phục giá trị trước · xác nhận riêng</button>
          </div>}
          {writeBusy && <p className="muted">Đang đọc/ghi và xác minh tham số…</p>}
          {writeMessage && <p className={writeMessage.includes("thành công") || writeMessage.includes("Đã ghi và đọc lại") || writeMessage.includes("Đã khôi phục") ? "success-note" : "warning"}>{writeMessage}</p>}
          {!nativeOscAvailable && <p className="warning">Chức năng ghi có bảo vệ chỉ khả dụng trên APK Android có native OSC bridge.</p>}
          {liveMonitoring && <p className="warning">Hãy dừng Live Monitor trước khi chuẩn bị hoặc ghi tham số để tránh truy vấn đồng thời.</p>}
          <p className="warning">Cảnh báo: thao tác có thể thay đổi âm thanh đang phát. Bắt đầu ở mức âm lượng thấp, kiểm tra loa/amp và không thay đổi khi đang phục vụ chương trình. Preamp trim chỉ có tác dụng với nguồn digital theo tài liệu giao thức.</p>
        </section>}
        {tableScopeRows.length > 0 && <div className="table-wrap mixer-state-table">
          <table>
            <thead><tr><th>STRIP</th><th>TÊN</th><th>FADER*</th><th>ON</th><th>PAN</th><th>PREAMP</th><th>EQ</th><th>DYN</th></tr></thead>
            <tbody>{tableScopeRows.map(row => <tr key={row.id}>
              <td><b>{row.id.replace("/", "").toUpperCase()}</b></td>
              <td>{renderOscValue(row.values.name)}</td>
              <td>{row.values.fader === undefined ? "—" : formatControlRaw("mix/fader", Number(row.values.fader))}</td>
              <td>{row.values.on === undefined ? "—" : Number(row.values.on) === 1 ? "ON" : "OFF"}</td>
              <td>{renderOscValue(row.values.pan)}</td>
              <td>{row.values.trim === undefined ? "—" : formatControlRaw("preamp/trim", Number(row.values.trim))}</td>
              <td>{row.values.eq === undefined ? "—" : Number(row.values.eq) === 1 ? "ON" : "OFF"}</td>
              <td>{row.values.dyn === undefined ? "—" : Number(row.values.dyn) === 1 ? "ON" : "OFF"}</td>
            </tr>)}</tbody>
          </table>
          <small className="muted">* Fader và preamp trim đã đổi từ giá trị OSC chuẩn hóa sang dB để dễ đối chiếu.</small>
        </div>}
        {queryResults.length > 0 && <details className="rta-frequency-bookmarks">
          <summary>Dữ liệu OSC nhận được · {queryResults.length} tham số</summary>
          <div className="osc-query-results">
            {queryResults.slice(-24).map(result => <div className="osc-query-result" key={result.requestedAddress}>
              <div><b>{result.responseAddress || result.requestedAddress}</b><small>{result.host}:{result.port} · {result.rttMs} ms · {new Date(result.receivedAt).toLocaleTimeString("vi-VN")}</small></div>
              <code>{JSON.stringify(result.arguments)}</code>
            </div>)}
          </div>
        </details>}
        {snapshots.length > 0 && <details className="rta-frequency-bookmarks">
          <summary>Snapshot đã lưu · {snapshots.length}</summary>
          {snapshots.map(snapshot => <div className="osc-line" key={snapshot.id}>
            <div><b>{snapshot.label}</b><small>{new Date(snapshot.capturedAt).toLocaleString("vi-VN")} · {snapshot.host} · {snapshot.results.length} tham số</small></div>
            <button type="button" className="icon-button" aria-label="Xuất snapshot" onClick={() => exportSnapshot(snapshot)}><Download /></button>
          </div>)}
        </details>}
        <p className="muted">Đọc trạng thái và Live Monitor chỉ gửi truy vấn. Thay đổi tham số chỉ thực hiện qua mục Guarded Parameter Control sau xác nhận riêng, đọc lại trước/sau và không tự động chạy theo phép đo.</p>
      </section>}
      {isOsc && <section className="osc-preview">
        <div className="protection-subheading"><SlidersHorizontal /><b>OSC READ PATH REFERENCE</b><span>NO AUTO-WRITE</span></div>
        {osc.map(item => <div className="osc-line" key={item.action}><div><b>{item.action}</b><code>{item.address}</code><small>{item.value}</small></div><button type="button" className="icon-button" aria-label="Copy OSC address" onClick={() => void navigator.clipboard.writeText(item.address).catch(() => undefined)}><Copy /></button></div>)}
        <a className="device-doc-link" href="https://www.z80ne.com/behringer/docs/X32-OSC%20v.4.0.pdf" target="_blank" rel="noreferrer">X32/M32 OSC protocol reference <ExternalLink /></a>
      </section>}
      {selected.protocol === "ui-web" && <div className="protection-actions"><button type="button" onClick={openUiConsole}><ExternalLink /> Mở giao diện web mixer</button></div>}
      {(selected.protocol === "dbx-app" || selected.protocol === "hiqnet") && <p className="muted">Sử dụng ứng dụng/tài liệu chính hãng qua liên kết bên dưới. Tích hợp trực tiếp vào Church Audio cần driver hoặc SDK/giao thức đã được hãng xác nhận.</p>}
      <a className="device-doc-link" href={selected.docs} target="_blank" rel="noreferrer">Tài liệu / hỗ trợ chính hãng hoặc nguồn thông số model <ExternalLink /></a>
    </section>
    <div className="protection-actions"><button type="button" onClick={exportConfig}><Download /> Xuất hồ sơ model JSON</button></div>
    <p className="warning protection-warning"><ShieldAlert /> X32/M32 hỗ trợ đọc trạng thái và một tập lệnh ghi có bảo vệ cho input channels. Các lệnh ghi bị giới hạn theo dải an toàn, yêu cầu xác nhận riêng và xác minh sau khi gửi; bus/main/routing/scene vẫn chưa cho phép ghi.</p>
  </article>;
}
