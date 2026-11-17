export type MeasurementEvidence = {
  knownInputChain: boolean;
  measurementMicCalibrated: boolean;
  acousticCalibratorVerified: boolean;
  dualChannelLoopback: boolean;
  sharedHardwareClock: boolean;
  latencyCharacterized: boolean;
  perInputCalibration: boolean;
  multiSourceSynchronous: boolean;
  manufacturerPolarDataVerified: boolean;
};
export type ReadinessState = "ready" | "limited";
export type ReadinessItem = { id: string; title: string; state: ReadinessState; explanation: string; };
/** Gates engineering claims on evidence supplied by the operator; this is not instrument verification or certification. */
export function assessMeasurementReadiness(evidence: MeasurementEvidence): ReadinessItem[] {
  const calibratedSpl = evidence.knownInputChain && evidence.measurementMicCalibrated && evidence.acousticCalibratorVerified;
  const coherentReference = evidence.dualChannelLoopback && evidence.sharedHardwareClock;
  const absoluteDelay = coherentReference && evidence.latencyCharacterized;
  const multiSourcePhase = evidence.perInputCalibration && evidence.multiSourceSynchronous && evidence.sharedHardwareClock;
  return [
    { id: "spl", title: "SPL tuyệt đối", state: calibratedSpl ? "ready" : "limited", explanation: calibratedSpl ? "Chuỗi input đã biết, microphone đo đã hiệu chuẩn và offset đã xác minh bằng calibrator." : "Chỉ báo mức tương đối/dBFS. Cần xác minh chuỗi input, calibration riêng của mic và acoustic calibrator." },
    { id: "transfer", title: "Transfer Function / Phase", state: coherentReference ? "ready" : "limited", explanation: coherentReference ? "Đã khai báo loopback/reference và shared hardware clock; vẫn cần kiểm chứng bằng phép đo lặp." : "Không kết luận phase/coherence kiểu dual-channel khi thiếu loopback đồng bộ và shared hardware clock." },
    { id: "delay", title: "Delay tuyệt đối", state: absoluteDelay ? "ready" : "limited", explanation: absoluteDelay ? "Có reference đồng bộ và đặc tính latency đã được đo/hiệu chỉnh." : "Chỉ xem là ước lượng tương đối cho đến khi có reference đồng bộ, shared clock và latency characterization." },
    { id: "multi-level", title: "So sánh mức nhiều microphone", state: evidence.perInputCalibration ? "ready" : "limited", explanation: evidence.perInputCalibration ? "Mỗi chuỗi input có hồ sơ hiệu chuẩn riêng." : "Không so sánh SPL tuyệt đối giữa các mic chưa được hiệu chuẩn độc lập." },
    { id: "multi-phase", title: "Cộng pha / căn chỉnh đa nguồn", state: multiSourcePhase ? "ready" : "limited", explanation: multiSourcePhase ? "Các nguồn được hiệu chuẩn riêng và xác nhận đồng bộ trên cùng clock." : "Phổ tổng hợp đa nguồn chỉ là overview tương đối; chưa đủ điều kiện cộng pha hoặc căn chỉnh sample-accurate." },
    { id: "coverage", title: "Dự đoán phủ âm theo dữ liệu hãng", state: evidence.manufacturerPolarDataVerified ? "ready" : "limited", explanation: evidence.manufacturerPolarDataVerified ? "Đã xác minh polar/beamwidth đúng model, cấu hình và dải tần." : "Chỉ hiển thị mô hình hình học/ước lượng. Không coi là dự đoán EASE/GLL hoặc dữ liệu polar của hãng." },
  ];
}
