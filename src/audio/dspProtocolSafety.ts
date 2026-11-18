export type DspProtocolEvidence = {
  manufacturer: string;
  model: string;
  hardwareRevision: string;
  firmwareVersion: string;
  officialProtocolReference: string;
  transportDocumented: boolean;
  authenticationDocumented: boolean;
  readOnlyIdentityTested: boolean;
  parameterReadBackTested: boolean;
  configurationSnapshotVerified: boolean;
  rollbackTested: boolean;
  benchTestCompleted: boolean;
  technicianApproval: boolean;
};

export type DspProtocolAssessment = {
  status: "manual-only" | "read-only-candidate" | "engineering-review-required";
  exactDeviceIdentified: boolean;
  protocolEvidenceComplete: boolean;
  readOnlyEvidenceComplete: boolean;
  writeReviewEvidenceComplete: boolean;
  liveControlEnabled: false;
  hardwareWriteEnabled: false;
  missingEvidence: string[];
  safeguards: string[];
};

/**
 * Verifies evidence completeness for a future adapter review. This module
 * intentionally cannot enable live control or send hardware writes.
 */
export function assessDspProtocolEvidence(evidence: DspProtocolEvidence): DspProtocolAssessment {
  const exactDeviceIdentified = Boolean(
    evidence.manufacturer.trim() && evidence.model.trim() &&
    evidence.hardwareRevision.trim() && evidence.firmwareVersion.trim()
  );
  const checks: Array<[string, boolean]> = [
    ["Exact manufacturer/model/hardware revision/firmware", exactDeviceIdentified],
    ["Official protocol reference", Boolean(evidence.officialProtocolReference.trim())],
    ["Documented transport", evidence.transportDocumented],
    ["Documented authentication", evidence.authenticationDocumented],
    ["Read-only device identity test", evidence.readOnlyIdentityTested],
    ["Parameter read-back test", evidence.parameterReadBackTested],
    ["Configuration snapshot", evidence.configurationSnapshotVerified],
    ["Rollback test", evidence.rollbackTested],
    ["Bench test", evidence.benchTestCompleted],
    ["Technician approval", evidence.technicianApproval],
  ];
  const missingEvidence = checks.filter(([, complete]) => !complete).map(([label]) => label);
  const protocolEvidenceComplete = checks.slice(0, 4).every(([, complete]) => complete);
  const readOnlyEvidenceComplete = protocolEvidenceComplete &&
    checks.slice(4, 6).every(([, complete]) => complete);
  const writeReviewEvidenceComplete = readOnlyEvidenceComplete &&
    checks.slice(6).every(([, complete]) => complete);
  const status = !protocolEvidenceComplete ? "manual-only"
    : !readOnlyEvidenceComplete ? "engineering-review-required"
      : "read-only-candidate";
  return {
    status,
    exactDeviceIdentified,
    protocolEvidenceComplete,
    readOnlyEvidenceComplete,
    writeReviewEvidenceComplete,
    liveControlEnabled: false,
    hardwareWriteEnabled: false,
    missingEvidence,
    safeguards: [
      "Không dò quét LAN hoặc gửi gói tin theo cổng/giao thức suy đoán.",
      "Model, hardware revision và firmware phải khớp chính xác với tài liệu giao thức.",
      "Read-only candidate không đồng nghĩa đã được kiểm định hoặc cho phép ghi tham số.",
      "Mọi thay đổi DSP vẫn phải thực hiện thủ công bởi kỹ thuật viên trong giai đoạn này.",
      "Bản thân module này không chứa transport, command encoder hoặc hàm ghi thiết bị.",
    ],
  };
}
