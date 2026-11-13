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


import type { TransferPoint } from "./transfer";
export type ParametricEqFilter = { frequencyHz: number; gainDb: number; q: number; coherence: number; excessDb: number };

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Cut-only PEQ candidates from high-coherence transfer data; recommendations are not auto-applied. */
export function suggestParametricEq(points: TransferPoint[]): ParametricEqFilter[] {
  const usable = points
    .filter(p => p.frequencyHz >= 80 && p.frequencyHz <= 12000 && p.coherence >= 0.8 && Number.isFinite(p.magnitudeDb))
    .sort((a,b)=>a.frequencyHz-b.frequencyHz);
  if (usable.length < 24) return [];
  const smooth = usable.map(point => {
    const width = Math.pow(2, 1/12);
    return median(usable.filter(p=>p.frequencyHz>=point.frequencyHz/width&&p.frequencyHz<=point.frequencyHz*width).map(p=>p.magnitudeDb));
  });
  const candidates: ParametricEqFilter[] = [];
  for (let i=6; i<usable.length-6; i++) {
    const center = usable[i];
    if (center.coherence < 0.85 || smooth[i] <= smooth[i-1] || smooth[i] < smooth[i+1]) continue;
    const low = center.frequencyHz / Math.SQRT2, high = center.frequencyHz * Math.SQRT2;
    const context = usable.map((p,index)=>({p,index})).filter(x=>(x.p.frequencyHz>=low&&x.p.frequencyHz<=high)&&(x.index<i-3||x.index>i+3)).map(x=>smooth[x.index]);
    const baseline = median(context);
    const excess = smooth[i] - baseline;
    if (excess < 3) continue;
    const halfPeak = baseline + excess * 0.5;
    let left = i, right = i;
    while(left>0&&smooth[left]>halfPeak) left--;
    while(right<usable.length-1&&smooth[right]>halfPeak) right++;
    const bandwidth = Math.max(center.frequencyHz*0.08, usable[right].frequencyHz-usable[left].frequencyHz);
    const q = Math.max(0.7, Math.min(10, center.frequencyHz/bandwidth));
    candidates.push({
      frequencyHz: Math.round(center.frequencyHz),
      gainDb: -Math.min(6, Math.max(1.5, Math.round(excess*0.65*10)/10)),
      q: Math.round(q*10)/10,
      coherence: center.coherence,
      excessDb: Math.round(excess*10)/10,
    });
  }
  const ranked = candidates.sort((a,b)=>b.excessDb-a.excessDb);
  const selected: ParametricEqFilter[] = [];
  for (const candidate of ranked) {
    if (selected.every(f=>Math.abs(Math.log2(candidate.frequencyHz/f.frequencyHz))>1/3)) selected.push(candidate);
    if (selected.length>=8) break;
  }
  return selected.sort((a,b)=>a.frequencyHz-b.frequencyHz);
}
