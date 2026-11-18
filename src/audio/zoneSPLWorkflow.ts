export type SpeakerGeometry = {
  id: number; name: string; zone: string; x: number; y: number; z: number;
};
export type DelayRecommendation = {
  speakerId: number; speakerName: string; zone: string;
  distanceM: number; relativeDelayMs: number;
};
export type SurveyPoint = {
  id: number; zone: string; position: string; levelDb: number; unit: "dBFS" | "dB SPL";
  timestamp: number; inputLabel: string; xM?: number; yM?: number;
};
export type SurveyReport = {
  schemaVersion: "church-audio-survey-v1";
  generatedAt: string;
  project: { roomLengthM: number; roomWidthM: number; roomHeightM: number };
  measurementIntegrity: {
    measuredValuesOnly: true;
    simulatedValuesIncluded: false;
    dBFSIsSPL: false;
    dspWritesPerformed: false;
  };
  measurements: SurveyPoint[];
  limitations: string[];
};

/** Geometry-only relative arrival-time suggestion. It never writes to DSP. */
export function calculateGeometricDelayRecommendations(
  speakers: SpeakerGeometry[], listener: { x: number; y: number; earHeightM?: number },
  speedOfSoundMps = 343,
): DelayRecommendation[] | null {
  const earHeight = listener.earHeightM ?? 1.2;
  if (!speakers.length || ![listener.x, listener.y, earHeight, speedOfSoundMps].every(Number.isFinite) ||
      speedOfSoundMps < 300 || speedOfSoundMps > 360 ||
      speakers.some((speaker) => ![speaker.x, speaker.y, speaker.z].every(Number.isFinite))) return null;
  const distances = speakers.map((speaker) => ({
    speaker, distanceM: Math.hypot(listener.x - speaker.x, listener.y - speaker.y, earHeight - speaker.z),
  }));
  const farthest = Math.max(...distances.map((entry) => entry.distanceM));
  return distances.map(({ speaker, distanceM }) => ({
    speakerId: speaker.id, speakerName: speaker.name, zone: speaker.zone,
    distanceM, relativeDelayMs: Math.max(0, (farthest - distanceM) / speedOfSoundMps * 1000),
  }));
}

export function buildSurveyReport(
  measurements: SurveyPoint[],
  project: { roomLengthM: number; roomWidthM: number; roomHeightM: number },
  generatedAt = new Date().toISOString(),
): SurveyReport {
  return {
    schemaVersion: "church-audio-survey-v1",
    generatedAt,
    project,
    measurementIntegrity: {
      measuredValuesOnly: true,
      simulatedValuesIncluded: false,
      dBFSIsSPL: false,
      dspWritesPerformed: false,
    },
    measurements: measurements.map((record) => ({ ...record })),
    limitations: [
      "Only recorded microphone measurements are included; simulated coverage is excluded.",
      "dBFS is a relative digital level and is not dB SPL.",
      "dB SPL requires a verified calibration chain for the exact microphone and input.",
      "Geometric delay is advisory and excludes latency, DSP processing, phase response, reflections and crossover behaviour.",
      "No EQ, gain, mute, delay or routing changes were written to any DSP.",
      "The report is not an IEC 61672 or ISO 3382 compliance certificate.",
    ],
  };
}
