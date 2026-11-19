import { analyzePhaseDelayAlignment, type AlignmentCapture } from "./phaseDelayAlignment.ts";
import { comparePhaseInBand, type DelayEvidence, type PhaseTransferPoint } from "./phaseAlignment.ts";
import { assessAutoEqReadiness, suggestParametricEq, type AutoEqMeasurementPoint, type AutoEqTargetProfile } from "./autoEq.ts";

export type AlignmentSpeaker = { id: number | string; name: string; zone: string; x: number; y: number; z: number };
export type ListenerCoordinate = { x: number; y: number; z: number };
export type GeometricDelayRow = { speakerId: string; speakerName: string; zone: string; distanceM: number; delayMs: number; reference: boolean };
export type GeometricDelayPlan = { status: "ready" | "blocked"; speedOfSoundMps: number; referenceDistanceM: number | null; rows: GeometricDelayRow[]; writeEnabled: false; reason: string };
const finite = (n: number) => Number.isFinite(n);

/** Geometry-only arrival-time starting point at one explicit listening coordinate. */
export function buildGeometricDelayPlan(
  speakers: AlignmentSpeaker[], listener: ListenerCoordinate, speedOfSoundMps = 343,
): GeometricDelayPlan {
  const blocked = (reason: string): GeometricDelayPlan => ({ status: "blocked", speedOfSoundMps, referenceDistanceM: null, rows: [], writeEnabled: false, reason });
  if (![listener.x, listener.y, listener.z, speedOfSoundMps].every(finite) || speedOfSoundMps < 300 || speedOfSoundMps > 360)
    return blocked("Tọa độ người nghe hoặc tốc độ âm thanh không hợp lệ (300–360 m/s).");
  if (speakers.length < 2) return blocked("Cần ít nhất hai loa/vùng có tọa độ để tính tương quan hình học.");
  const ids = speakers.map(s => String(s.id));
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) return blocked("ID loa phải có giá trị và không trùng.");
  if (speakers.some(s => !s.name.trim() || !s.zone.trim() || ![s.x,s.y,s.z].every(finite)))
    return blocked("Mỗi loa cần tên, vùng và tọa độ XYZ hợp lệ.");
  const distances = speakers.map(s => ({ speaker:s, distanceM:Math.hypot(listener.x-s.x,listener.y-s.y,listener.z-s.z) }));
  if (distances.some(d => d.distanceM < 0.05)) return blocked("Vị trí người nghe trùng tọa độ loa; hãy kiểm tra lại điểm đo.");
  const referenceDistanceM = Math.max(...distances.map(d=>d.distanceM));
  const rows = distances.map(({speaker,distanceM}) => ({
    speakerId:String(speaker.id), speakerName:speaker.name, zone:speaker.zone, distanceM,
    delayMs:(referenceDistanceM-distanceM)/speedOfSoundMps*1000,
    reference:Math.abs(referenceDistanceM-distanceM)<1e-8,
  })).sort((a,b)=>a.zone.localeCompare(b.zone,"vi")||a.speakerName.localeCompare(b.speakerName,"vi"));
  return { status:"ready", speedOfSoundMps, referenceDistanceM, rows, writeEnabled:false,
    reason:"Ước lượng hình học tại một điểm nghe duy nhất; lấy loa xa nhất làm mốc 0 ms. Không bao gồm latency DSP, crossover, hướng tính, phản xạ hoặc nhiều điểm nghe. Phải xác minh bằng impulse/transfer đo đồng bộ." };
}

/** v0.92: phase-slope alignment is allowed only when all synchronization evidence is explicitly true. */
export function buildSynchronousPhaseDelayReview(captures: AlignmentCapture[], evidence: DelayEvidence) {
  return analyzePhaseDelayAlignment(captures,evidence);
}

/** v0.93: phase/polarity review in one crossover band; no polarity command is emitted. */
export function buildPhaseBandReview(reference: PhaseTransferPoint[], target: PhaseTransferPoint[], crossoverHz: number) {
  return comparePhaseInBand(reference,target,crossoverHz);
}

/** v0.94–v0.95: conservative cut-only PEQ worksheet from coherent measured transfer bins. */
export function buildCutOnlyEqReview(points: AutoEqMeasurementPoint[], profile: AutoEqTargetProfile = "spoken-word") {
  const readiness = assessAutoEqReadiness(points);
  return { readiness, filters: readiness.ready ? suggestParametricEq(points,profile) : [],
    profile, writeEnabled:false as const,
    reason: readiness.ready ? "Bộ lọc PEQ chỉ cắt, tối đa 6 điểm và tối đa -4 dB mỗi điểm. Kiểm tra đa vị trí, headroom và nghe thử; không tự áp dụng." : readiness.reason };
}
