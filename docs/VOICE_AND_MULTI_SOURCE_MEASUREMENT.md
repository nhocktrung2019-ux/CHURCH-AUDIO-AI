# Cảnh báo hú rít và đo đa nguồn

## Cảnh báo hú rít bằng tiếng Việt

- Ứng dụng phân tích các đỉnh phổ hẹp tồn tại qua nhiều khung RTA và hiển thị cảnh báo chữ tiếng Việt ngay trong màn hình chống hú.
- Cảnh báo phân thành trạng thái bình thường, cần kiểm tra và cảnh báo cao nghi có hú rít. Tần số, độ nổi và tỷ lệ xuất hiện được hiển thị để kỹ thuật viên xác định kênh cần kiểm tra.
- Cảnh báo chỉ hiển thị bằng văn bản, không sử dụng nhận dạng giọng nói hoặc đọc văn bản thành tiếng.
- Một đỉnh phổ hẹp có thể do cộng hưởng, tín hiệu thử hoặc nguồn âm ổn định; một microphone không đủ chứng minh có vòng hồi tiếp âm học. Luôn nghe và xác minh bằng cách kiểm tra từng micro/kênh; không tự động áp EQ chỉ từ cảnh báo.
- Khi nghi hú: hạ gain kênh hoặc monitor liên quan, kiểm tra vị trí/hướng micro và loa, mute/solo từng kênh có kiểm soát; chỉ notch EQ sau khi xác nhận tần số và nguồn.

## Một phép đo với nhiều nguồn

Bảng đo cho phép chọn tối đa bốn thiết bị audioinput được hệ điều hành liệt kê riêng. Mỗi thiết bị được mở thành luồng getUserMedia độc lập, có RTA 64 band riêng và danh sách đỉnh phổ riêng. Cảnh báo tiếng Việt được hiển thị theo từng nguồn.

Phổ tổng hợp được tính bằng cách đổi từng band từ dBFS sang công suất tuyến tính, lấy trung bình công suất rồi đổi trở lại dB. Đây chỉ là xu hướng tương đối; không phải tổng pha đồng bộ, phép đo SPL đã hiệu chuẩn, transfer function hay bằng chứng các nguồn dùng chung hardware clock. Độ nhạy, đáp tuyến, latency và xử lý tín hiệu của hệ điều hành có thể khác nhau giữa các micro.

## Giới hạn phần cứng và phép đo

- Thu đồng thời phụ thuộc Android Audio HAL, WebView, driver và firmware. Một số thiết bị chỉ cho phép một phiên thu.
- Một USB interface đa kênh có thể xuất hiện thành một audioinput duy nhất. Bản này chưa chọn riêng được từng hardware channel nằm bên trong device đó.
- Các interface USB riêng biệt có thể sử dụng clock độc lập. Ứng dụng cập nhật phân tích trong cùng phiên nhưng không bảo đảm đồng bộ mẫu tuyệt đối.
- Hiệu chuẩn từng chuỗi micro/input riêng trước khi so sánh SPL. Một offset hiệu chuẩn dùng chung không đủ cho các micro có độ nhạy khác nhau.
- Không dùng phổ tổng hợp để tính phase, delay, cộng mảng đồng pha, chứng nhận RT60 hoặc SPL tuyệt đối. Các tác vụ này cần interface đa kênh dùng chung clock và audio engine có phân tách kênh.
- Ứng dụng không tự thay đổi gain, mute, automix, ducker hoặc EQ phần cứng trên mixer.

## Quy trình đề xuất

1. Kết nối micro đo/interface và cấp quyền micro cho phép đo.
2. Quét thiết bị, chỉ chọn các đầu vào cần dùng trong phiên.
3. Bắt đầu ở mức PA/monitor thấp và xác minh từng kênh có tín hiệu.
4. Theo dõi RTA và cảnh báo hú rít tiếng Việt theo từng nguồn; dùng phổ tổng hợp như tham khảo nhanh.
5. Hạ gain, cô lập từng kênh để xác minh nguồn trước khi chỉnh notch EQ.
6. Hiệu chuẩn từng chuỗi đo trước khi so sánh SPL.
7. Dùng interface đa kênh chung clock, loopback reference và driver tách kênh cho công việc phase/delay/transfer function.
