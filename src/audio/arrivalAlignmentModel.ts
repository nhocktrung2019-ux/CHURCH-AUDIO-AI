export type ArrivalSpeaker = {
  id: number; name: string; zone: string;
  x: number; y: number; z: number;
};

export type ArrivalAlignment = {
  speakerId: number;
  speakerName: string;
  zone: string;
  distanceM: number;
  arrivalMs: number;
  suggestedDelayMs: number;
  relativeToLatestMs: number;
};

export type ArrivalMapCell = {
  x: number; y: number; earliestArrivalMs: number; latestArrivalMs: number;
  spreadMs: number; dominantSpeakerId: number;
};

export type ArrivalAlignmentResult = {
  speedOfSound: number;
  referenceArrivalMs: number;
  referenceSpreadMs: number;
  alignments: ArrivalAlignment[];
  map: ArrivalMapCell[];
};

export function speedOfSoundAtTemperature(tempC: number): number {
  if (!Number.isFinite(tempC)) return 343.42;
  return 331.3 + 0.606 * Math.max(-20, Math.min(50, tempC));
}

export function buildArrivalAlignment(
  speakers: ArrivalSpeaker[],
  reference: { x: number; y: number; z: number },
  temperatureC = 20,
  options: { cols?: number; rows?: number; roomLength?: number; roomWidth?: number } = {},
): ArrivalAlignmentResult | null {
  if (!speakers.length || ![reference.x, reference.y, reference.z].every(Number.isFinite)) return null;
  const speed = speedOfSoundAtTemperature(temperatureC);
  const valid = speakers.filter(s => [s.x,s.y,s.z].every(Number.isFinite));
  if (!valid.length) return null;
  const raw = valid.map(s => {
    const distance = Math.hypot(reference.x-s.x, reference.y-s.y, reference.z-s.z);
    return { speaker:s, distance, arrivalMs: distance/speed*1000 };
  });
  const latest = Math.max(...raw.map(x=>x.arrivalMs));
  const alignments = raw.map(({speaker,distance,arrivalMs})=>({
    speakerId:speaker.id, speakerName:speaker.name, zone:speaker.zone,
    distanceM:distance, arrivalMs, suggestedDelayMs:Math.max(0,latest-arrivalMs),
    relativeToLatestMs:latest-arrivalMs,
  }));
  const cols=Math.max(3,Math.min(31,Math.floor(options.cols??11)));
  const rows=Math.max(3,Math.min(25,Math.floor(options.rows??9)));
  const map:ArrivalMapCell[]=[];
  if (Number.isFinite(options.roomLength)&&Number.isFinite(options.roomWidth)&&
      (options.roomLength as number)>0&&(options.roomWidth as number)>0) {
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const x=(col+.5)/cols*(options.roomLength as number);
      const y=(row+.5)/rows*(options.roomWidth as number);
      const times=valid.map(s=>({id:s.id,ms:Math.hypot(x-s.x,y-s.y,reference.z-s.z)/speed*1000}));
      const earliest=Math.min(...times.map(t=>t.ms)),latestAtPoint=Math.max(...times.map(t=>t.ms));
      const dominant=[...times].sort((a,b)=>a.ms-b.ms)[0];
      map.push({x,y,earliestArrivalMs:earliest,latestArrivalMs:latestAtPoint,spreadMs:latestAtPoint-earliest,dominantSpeakerId:dominant.id});
    }
  }
  return {
    speedOfSound:speed,
    referenceArrivalMs:Math.min(...raw.map(x=>x.arrivalMs)),
    referenceSpreadMs:(latest-Math.min(...raw.map(x=>x.arrivalMs))),
    alignments:alignments.sort((a,b)=>a.zone.localeCompare(b.zone)||a.speakerName.localeCompare(b.speakerName)),
    map,
  };
}
