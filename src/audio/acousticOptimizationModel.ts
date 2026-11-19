type CoverageSpeaker = { x:number; y:number; z:number; azimuth:number; coverage:number; verticalCoverage:number };
function getSpeakerCoverageStatus(speaker: CoverageSpeaker, listener: {x:number;y:number;z:number}) {
  const dx=listener.x-speaker.x, dy=listener.y-speaker.y;
  const horizontalDistance=Math.hypot(dx,dy);
  const bearing=Math.atan2(dy,dx)*180/Math.PI;
  const horizontalAngle=((bearing-speaker.azimuth+540)%360)-180;
  const verticalAngle=Math.atan2(listener.z-speaker.z,Math.max(.01,horizontalDistance))*180/Math.PI;
  const horizontalRatio=Math.abs(horizontalAngle)/Math.max(2.5,Math.min(90,speaker.coverage/2));
  const verticalRatio=Math.abs(verticalAngle)/Math.max(2.5,Math.min(90,speaker.verticalCoverage/2));
  return {horizontalRatio,verticalRatio};
}

export type OptimizationSpeaker = {
  id: number;
  name: string;
  zone: string;
  x: number; y: number; z: number;
  azimuth: number; coverage: number; verticalCoverage: number;
  sensitivity: number | null;
  powerW: number | null;
};

export type AcousticOptimizationResult = {
  speakerId: number;
  speakerName: string;
  zone: string;
  currentAzimuth: number;
  suggestedAzimuth: number;
  baselineScore: number;
  suggestedScore: number;
  improvementPercent: number;
  baselineMeanDb: number;
  suggestedMeanDb: number;
  baselineSpreadDb: number;
  suggestedSpreadDb: number;
  analyzedPoints: number;
};

type Room = { length: number; width: number };

const wrapAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;

function evaluate(
  speakers: OptimizationSpeaker[],
  room: Room,
  targetSpl: number,
  cols: number,
  rows: number,
) {
  const values: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) / cols * room.length;
      const y = (row + 0.5) / rows * room.width;
      let energy = 0;
      let hasUsableSource = false;
      for (const speaker of speakers) {
        if (!Number.isFinite(speaker.sensitivity) || !Number.isFinite(speaker.powerW) ||
            (speaker.sensitivity as number) < 50 || (speaker.sensitivity as number) > 130 ||
            (speaker.powerW as number) <= 0 || (speaker.powerW as number) > 10000) continue;
        const distance = Math.hypot(x - speaker.x, y - speaker.y, 1.2 - speaker.z);
        if (!Number.isFinite(distance) || distance < 0.1) continue;
        const angular = getSpeakerCoverageStatus(speaker, { x, y, z: 1.2 });
        const angularLoss = Math.max(-36, -6 * angular.horizontalRatio ** 2 - 6 * angular.verticalRatio ** 2);
        const spl = speaker.sensitivity as number + 10 * Math.log10(speaker.powerW as number) -
          20 * Math.log10(distance) + angularLoss;
        if (!Number.isFinite(spl)) continue;
        energy += 10 ** (spl / 10);
        hasUsableSource = true;
      }
      if (hasUsableSource && energy > 0) values.push(10 * Math.log10(energy));
    }
  }
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const min = Math.min(...values), max = Math.max(...values);
  const rmsTargetError = Math.sqrt(values.reduce((sum, value) => sum + (value - targetSpl) ** 2, 0) / values.length);
  // Prefer proximity to the requested target while penalizing unevenness.
  const score = rmsTargetError + Math.sqrt(variance) * 0.35;
  return { score, mean, spread: max - min, count: values.length };
}

/**
 * Searches small azimuth changes for each speaker independently.
 * Results are modeled suggestions only; they never mutate speaker settings.
 */
export function buildAimingRecommendations(
  speakers: OptimizationSpeaker[],
  room: Room,
  targetSpl: number,
  options: { cols?: number; rows?: number; maxAdjustmentDeg?: number; stepDeg?: number } = {},
): AcousticOptimizationResult[] {
  if (!Number.isFinite(room.length) || !Number.isFinite(room.width) ||
      room.length <= 0 || room.width <= 0 || !Number.isFinite(targetSpl)) return [];
  const cols = Math.max(3, Math.min(25, Math.floor(options.cols ?? 9)));
  const rows = Math.max(3, Math.min(21, Math.floor(options.rows ?? 7)));
  const maxAdjustment = Math.max(0, Math.min(60, options.maxAdjustmentDeg ?? 30));
  const step = Math.max(1, Math.min(15, options.stepDeg ?? 5));
  const usable = speakers.filter((speaker) =>
    Number.isFinite(speaker.x) && Number.isFinite(speaker.y) && Number.isFinite(speaker.z) &&
    Number.isFinite(speaker.azimuth) && Number.isFinite(speaker.coverage) &&
    Number.isFinite(speaker.verticalCoverage),
  );
  const baseline = evaluate(usable, room, targetSpl, cols, rows);
  if (!baseline || baseline.count < 4) return [];

  const results: AcousticOptimizationResult[] = [];
  for (const speaker of usable) {
    let best = { azimuth: wrapAngle(speaker.azimuth), metrics: baseline };
    for (let offset = -maxAdjustment; offset <= maxAdjustment + 1e-8; offset += step) {
      const candidateAzimuth = wrapAngle(speaker.azimuth + offset);
      const candidateSpeakers = usable.map((item) =>
        item.id === speaker.id ? { ...item, azimuth: candidateAzimuth } : item,
      );
      const metrics = evaluate(candidateSpeakers, room, targetSpl, cols, rows);
      if (metrics && metrics.score < best.metrics.score) best = { azimuth: candidateAzimuth, metrics };
    }
    const improvementPercent = baseline.score > 0
      ? (baseline.score - best.metrics.score) / baseline.score * 100
      : 0;
    results.push({
      speakerId: speaker.id,
      speakerName: speaker.name,
      zone: speaker.zone,
      currentAzimuth: wrapAngle(speaker.azimuth),
      suggestedAzimuth: best.azimuth,
      baselineScore: baseline.score,
      suggestedScore: best.metrics.score,
      improvementPercent,
      baselineMeanDb: baseline.mean,
      suggestedMeanDb: best.metrics.mean,
      baselineSpreadDb: baseline.spread,
      suggestedSpreadDb: best.metrics.spread,
      analyzedPoints: best.metrics.count,
    });
  }
  return results.sort((a, b) => b.improvementPercent - a.improvementPercent);
}
