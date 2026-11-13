export type Measurement = { id: number; name: string; distanceM: number; capturedAt: string; spectrum: number[] };
export type Zone = { id: number; name: string; distanceM: number };
export type EqSuggestion = { frequencyHz: number; cutDb: number; q: number };

export function calculateDelayMs(referenceDistanceM: number, speakerDistanceM: number): number {
  // Align the nearer arrival to the farthest/reference arrival.
  return Math.max(0, (referenceDistanceM - speakerDistanceM) / 343 * 1000);
}

export function logBandFrequency(index: number, count = 64): number {
  return 20 * Math.pow(1000, (index + 0.5) / count);
}

export function averageResponse(measurements: Measurement[]): number[] {
  if (!measurements.length) return [];
  const count = measurements[0].spectrum.length;
  return Array.from({length: count}, (_, i) => {
    const values = measurements.map(m => m.spectrum[i]).filter(Number.isFinite);
    return values.length ? values.reduce((a,b)=>a+b,0)/values.length : -100;
  });
}

export function suggestCuts(response: number[]): EqSuggestion[] {
  if (response.length < 8) return [];
  const smoothed = response.map((_,i) => {
    const a = response[Math.max(0,i-1)], b=response[i], c=response[Math.min(response.length-1,i+1)];
    return (a+b+c)/3;
  });
  const baseline = smoothed.reduce((a,b)=>a+b,0)/smoothed.length;
  const candidates: EqSuggestion[] = [];
  for(let i=2;i<smoothed.length-2;i++){
    const prominence=smoothed[i]-Math.max(smoothed[i-1],smoothed[i+1]);
    const excess=smoothed[i]-baseline;
    if(prominence>=2.5 && excess>=3){
      candidates.push({frequencyHz:Math.round(logBandFrequency(i,response.length)),cutDb:-Math.min(6,Math.max(2,Math.round(excess*0.65*10)/10)),q:2});
    }
  }
  return candidates.sort((a,b)=>a.frequencyHz-b.frequencyHz).slice(0,6);
}
