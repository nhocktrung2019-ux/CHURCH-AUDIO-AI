export type AlignmentMeasurement = { speakerId: string; distanceM: number; measuredArrivalMs?: number; phaseDeg?: number; frequencyHz?: number; sessionId: string; inputDeviceId?: string };
export type DelayRecommendation = { speakerId: string; geometricDelayMs: number; measuredDelayMs: number|null; recommendedAdditionalDelayMs: number|null; status: "geometric-only"|"measured"|"invalid" };
export function propagationTimeMs(distanceM: number, speedOfSoundMps = 343): number {
  if (!Number.isFinite(distanceM) || distanceM < 0 || !Number.isFinite(speedOfSoundMps) || speedOfSoundMps < 300 || speedOfSoundMps > 360) throw new Error("Khoảng cách hoặc tốc độ âm thanh không hợp lệ.");
  return distanceM / speedOfSoundMps * 1000;
}
export function calculateDelayRecommendations(items: AlignmentMeasurement[], referenceSpeakerId: string, speedOfSoundMps = 343): DelayRecommendation[] {
  const reference = items.find((item) => item.speakerId === referenceSpeakerId);
  if (!reference || !reference.sessionId || !Number.isFinite(reference.distanceM)) throw new Error("Thiếu loa tham chiếu hợp lệ.");
  return items.map((item) => {
    if (!item.speakerId || !item.sessionId || item.sessionId !== reference.sessionId || !Number.isFinite(item.distanceM) || item.distanceM < 0) return { speakerId: item.speakerId, geometricDelayMs: 0, measuredDelayMs: null, recommendedAdditionalDelayMs: null, status: "invalid" };
    const geometric = Math.max(0, propagationTimeMs(reference.distanceM, speedOfSoundMps) - propagationTimeMs(item.distanceM, speedOfSoundMps));
    const measured = Number.isFinite(item.measuredArrivalMs) ? item.measuredArrivalMs as number : null;
    return { speakerId: item.speakerId, geometricDelayMs: geometric, measuredDelayMs: measured, recommendedAdditionalDelayMs: measured === null ? null : Math.max(0, (reference.measuredArrivalMs ?? 0) - measured), status: measured === null ? "geometric-only" : "measured" };
  });
}
export function phaseDifferenceDegrees(a: number, b: number): number {
  if (![a,b].every(Number.isFinite)) throw new Error("Pha phải là số hữu hạn.");
  return ((a - b + 540) % 360) - 180;
}
export function phaseComparisonAllowed(a: AlignmentMeasurement, b: AlignmentMeasurement): boolean {
  return Boolean(a.sessionId && a.sessionId === b.sessionId && a.inputDeviceId && a.inputDeviceId === b.inputDeviceId && a.frequencyHz && a.frequencyHz === b.frequencyHz && Number.isFinite(a.phaseDeg) && Number.isFinite(b.phaseDeg));
}
