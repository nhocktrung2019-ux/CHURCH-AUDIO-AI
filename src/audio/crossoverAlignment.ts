export type CrossoverPoint = {
  frequencyHz: number;
  magnitudeDb: number;
  phaseDeg: number;
  coherence: number;
};

export type CrossoverAlignmentStatus =
  | "insufficient-data"
  | "review-polarity"
  | "good-overlap"
  | "review-delay-or-filter"
  | "review-level-balance";

export type CrossoverAlignmentResult = {
  status: CrossoverAlignmentStatus;
  crossoverHz: number;
  bandLowHz: number;
  bandHighHz: number;
  matchedBins: number;
  octaveCoverage: number;
  meanPhaseDifferenceDeg: number | null;
  phaseConcentration: number;
  meanMagnitudeDifferenceDb: number | null;
  averageCoherence: number;
  confidence: "low" | "medium" | "high";
  absoluteDelayAvailable: false;
  recommendation: string;
};

const wrap = (degrees: number) => {
  let value = degrees;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
};

/**
 * Reviews measured A/B acoustic responses around a proposed crossover.
 * Sequential A/B captures are suitable for relative phase-shape review only:
 * this function deliberately never derives absolute delay or DSP settings.
 */
export function analyzeCrossoverAlignment(
  responseA: CrossoverPoint[],
  responseB: CrossoverPoint[],
  crossoverHz: number,
  minimumCoherence = 0.8,
): CrossoverAlignmentResult {
  const low = crossoverHz / Math.SQRT2;
  const high = crossoverHz * Math.SQRT2;
  const base = {
    crossoverHz, bandLowHz: low, bandHighHz: high,
    matchedBins: 0, octaveCoverage: 0, meanPhaseDifferenceDeg: null,
    phaseConcentration: 0, meanMagnitudeDifferenceDb: null,
    averageCoherence: 0, confidence: "low" as const,
    absoluteDelayAvailable: false as const,
  };
  const insufficient = (recommendation: string): CrossoverAlignmentResult => ({
    ...base, status: "insufficient-data", recommendation,
  });
  if (!Number.isFinite(crossoverHz) || crossoverHz <= 0
    || !Number.isFinite(minimumCoherence) || minimumCoherence < 0 || minimumCoherence > 1) {
    return insufficient("Nhập tần số crossover và ngưỡng coherence hợp lệ.");
  }

  const a = responseA.filter(p => Number.isFinite(p.frequencyHz)
    && p.frequencyHz >= low && p.frequencyHz <= high
    && Number.isFinite(p.magnitudeDb) && Number.isFinite(p.phaseDeg)
    && Number.isFinite(p.coherence) && p.coherence >= minimumCoherence)
    .sort((x,y)=>x.frequencyHz-y.frequencyHz);
  const b = responseB.filter(p => Number.isFinite(p.frequencyHz)
    && p.frequencyHz >= low && p.frequencyHz <= high
    && Number.isFinite(p.magnitudeDb) && Number.isFinite(p.phaseDeg)
    && Number.isFinite(p.coherence) && p.coherence >= minimumCoherence)
    .sort((x,y)=>x.frequencyHz-y.frequencyHz);

  const pairs: { phase:number; magnitude:number; weight:number; coherence:number; frequency:number }[]=[];
  let lastB=-1;
  for (const point of a) {
    let best=-1, distance=Infinity;
    for(let i=0;i<b.length;i++) {
      const d=Math.abs(b[i].frequencyHz-point.frequencyHz);
      if(d<distance){distance=d;best=i;}
    }
    const tolerance=Math.max(2,point.frequencyHz*0.005);
    if(best<0||best===lastB||distance>tolerance) continue;
    lastB=best;
    const other=b[best], coherence=Math.min(point.coherence,other.coherence);
    pairs.push({
      phase:wrap(other.phaseDeg-point.phaseDeg)*Math.PI/180,
      magnitude:other.magnitudeDb-point.magnitudeDb,
      weight:coherence*coherence,coherence,frequency:point.frequencyHz,
    });
  }
  if(pairs.length<5) return insufficient("Cần ít nhất 5 cặp điểm hợp lệ trong dải crossover ±½ octave với coherence đạt ngưỡng.");

  const minF=pairs[0].frequency,maxF=pairs[pairs.length-1].frequency;
  const octaveCoverage=Math.log2(maxF/minF);
  if(octaveCoverage<0.5) return insufficient("Dải đo quá hẹp; cần tối thiểu nửa octave dữ liệu ghép cặp quanh crossover.");
  const total=pairs.reduce((s,p)=>s+p.weight,0);
  if(!(total>0)) return insufficient("Không có trọng số coherence đủ tin cậy.");
  const sin=pairs.reduce((s,p)=>s+Math.sin(p.phase)*p.weight,0)/total;
  const cos=pairs.reduce((s,p)=>s+Math.cos(p.phase)*p.weight,0)/total;
  const meanPhaseDifferenceDeg=Math.atan2(sin,cos)*180/Math.PI;
  const phaseConcentration=Math.min(1,Math.hypot(sin,cos));
  const meanMagnitudeDifferenceDb=pairs.reduce((s,p)=>s+p.magnitude*p.weight,0)/total;
  const averageCoherence=pairs.reduce((s,p)=>s+p.coherence*p.weight,0)/total;
  const confidence=pairs.length>=12&&averageCoherence>=0.9&&phaseConcentration>=0.85
    ?"high" as const:pairs.length>=7&&averageCoherence>=0.85
      ?"medium" as const:"low" as const;
  const phase=Math.abs(meanPhaseDifferenceDeg), level=Math.abs(meanMagnitudeDifferenceDb);
  let status:CrossoverAlignmentStatus;
  let recommendation:string;
  if(phaseConcentration<0.7){
    status="review-delay-or-filter";
    recommendation="Pha biến thiên lớn trong vùng giao nhau. Kiểm tra phản xạ, vị trí microphone, bộ lọc và đo lặp tại nhiều vị trí.";
  } else if(phase>=135){
    status="review-polarity";
    recommendation="Có dấu hiệu hai đáp tuyến gần đối pha quanh crossover. Xác minh polarity và đường tín hiệu; không tự đảo cực.";
  } else if(level>6){
    status="review-level-balance";
    recommendation="Chênh lệch mức trung bình vượt 6 dB. Kiểm tra gain, độ nhạy và đáp tuyến từng loa trước khi chỉnh crossover.";
  } else if(phase<=45&&level<=3){
    status="good-overlap";
    recommendation="Pha tương đối và mức hai đáp tuyến khá gần nhau trong vùng đo. Xác minh thêm ở các vị trí nghe khác.";
  } else {
    status="review-delay-or-filter";
    recommendation="Cần xem lại delay tương đối, tần số/độ dốc crossover và vị trí loa; xác minh bằng phép đo đồng thời nếu cần kết luận delay.";
  }
  return {
    ...base,status,matchedBins:pairs.length,octaveCoverage,meanPhaseDifferenceDeg,
    phaseConcentration,meanMagnitudeDifferenceDb,averageCoherence,confidence,recommendation,
  };
}
