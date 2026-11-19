export type SpeakerCoverageGeometry = {
  x: number; y: number; z: number;
  azimuth: number; coverage: number; verticalCoverage: number;
};

export type CoverageStatus = {
  inCoverage: boolean;
  horizontalAngle: number;
  verticalAngle: number;
  horizontalRatio: number;
  verticalRatio: number;
};

export function getSpeakerCoverageStatus(
  speaker: SpeakerCoverageGeometry,
  listener: { x: number; y: number; z: number },
): CoverageStatus {
  const dx = listener.x - speaker.x;
  const dy = listener.y - speaker.y;
  const horizontalDistance = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx) * 180 / Math.PI;
  const horizontalAngle = ((bearing - speaker.azimuth + 540) % 360) - 180;
  const verticalAngle = Math.atan2(listener.z - speaker.z, Math.max(0.01, horizontalDistance)) * 180 / Math.PI;
  const horizontalHalf = Math.max(2.5, Math.min(90, speaker.coverage / 2));
  const verticalHalf = Math.max(2.5, Math.min(90, speaker.verticalCoverage / 2));
  const horizontalRatio = Math.abs(horizontalAngle) / horizontalHalf;
  const verticalRatio = Math.abs(verticalAngle) / verticalHalf;
  return {
    inCoverage: horizontalRatio <= 1 && verticalRatio <= 1,
    horizontalAngle,
    verticalAngle,
    horizontalRatio,
    verticalRatio,
  };
}
