# Thư viện DSP và Mixer

## Phạm vi hiện có

Church Audio AI cung cấp phiếu cấu hình thủ công cho các dòng thiết bị được liệt kê trong `src/data/dspProfiles.ts`:

- db Acoustics CD48.
- Behringer X32 / Midas M32 và Behringer WING.
- Yamaha TF / DM3 và CL / QL.
- Allen & Heath SQ / Avantis / dLive.
- Soundcraft Ui và Si / Vi.
- dbx DriveRack PA2, VENU360, 4800 / 4820.
- QSC Q-SYS Core.

## Chức năng worksheet

- Lập sơ đồ input, bus, matrix, main và output.
- Ghi HPF, EQ, compressor, gate, limiter và delay dự kiến.
- Lưu tên hệ thống, model, routing, ghi chú kỹ thuật và checklist độ sẵn sàng phép đo.
- Xuất phiếu JSON để kỹ thuật viên rà soát trước khi nhập thủ công.

## Giới hạn an toàn

Danh mục model không đồng nghĩa hỗ trợ điều khiển trực tiếp. Tất cả profile hiện đặt `controlStatus: manual-only`; ứng dụng chưa tự gửi lệnh thay đổi gain, mute, EQ, compressor, limiter, routing hoặc preset tới thiết bị.

Không dùng chung adapter giao thức giữa các hãng hoặc giữa các dòng chỉ vì chúng có Ethernet. Trước khi bật điều khiển cần có tài liệu giao thức đúng model/firmware, kiểm tra xác thực, đọc trạng thái, xác nhận lệnh ghi, giới hạn tốc độ, xử lý mất kết nối và phương án rollback. CD48 vẫn cần xác minh giao thức/port chính thức; thông tin RJ45/IP chỉ là dữ liệu nhận diện phần cứng, không chứng minh DSP đã online.

## Quy trình phát triển adapter

1. Chọn model và firmware cụ thể.
2. Thu thập tài liệu hãng hoặc SDK được cấp phép.
3. Triển khai discovery/read-only và ghi log gói tin.
4. Kiểm tra phản hồi, reconnect, timeout và quyền truy cập.
5. Chỉ sau khi xác minh mới triển khai write với xác nhận người vận hành và rollback.
6. Kiểm thử trên thiết bị riêng, không thử lần đầu trong buổi lễ.
