export type SpeakerSpec = {
  manufacturer: string;
  model: string;
  horizontalDeg: number | null;
  verticalDeg: number | null;
  sensitivityDb1W1m: number | null;
  powerLongTermW: number | null;
  impedanceOhm: number | null;
  frequencyRangeHz?: [number, number] | null;
  frequencyRangeTolerance?: string;
  maxSPLContinuousDb?: number | null;
  maxSPLPeakDb?: number | null;
  maxSPLSource?: "manufacturer_published" | "calculated_estimate" | null;
  drivers?: string;
  dimensionsMm?: [number, number, number] | null;
  weightKg?: number | null;
  highPassHz?: number | null;
  powerTapsW?: number[];
  source: string;
  sourceNote: string;
  coverageByFrequency?: { frequencyHz: number; horizontalDeg: number | null; verticalDeg: number | null }[];
};

export const SPEAKER_SPECS: Record<string, SpeakerSpec> = {
  "CBT 50LA-1 (CBT 50)": {
    manufacturer: "JBL Professional", model: "CBT 50LA-1", horizontalDeg: 150, verticalDeg: 20,
    sensitivityDb1W1m: 89, powerLongTermW: 100, impedanceOhm: 8, frequencyRangeHz: [80, 20000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 111, maxSPLPeakDb: 117, maxSPLSource: "manufacturer_published",
    drivers: "8 × 50 mm (2 in) full-range",
    source: "https://jblpro.com/en-US/products/cbt-50la-1",
    sourceNote: "JBL official spec: music mode sensitivity 89 dB (300 Hz–18 kHz), 100 W/100 h, 111 dB continuous average / 117 dB peak music mode. Speech mode differs; transformer taps 60/30/15 W (7.5 W at 70 V only) and 8 Ω direct."
  },
  "CBT 70J-1 (CBT 70)": {
    manufacturer: "JBL Professional", model: "CBT 70J-1", horizontalDeg: 150, verticalDeg: 45,
    sensitivityDb1W1m: 92, powerLongTermW: 350, impedanceOhm: 8, frequencyRangeHz: [60, 20000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 119, maxSPLPeakDb: 125, maxSPLSource: "manufacturer_published",
    drivers: "4 × 130 mm (5 in) LF + 16 × 25 mm (1 in) HF",
    source: "https://jblpro.com/en-US/products/cbt-70j-1",
    sourceNote: "JBL official spec: 150° H; vertical switchable 25° narrow / 45° broad. Music mode broad sensitivity 92 dB and 119 dB continuous average / 125 dB peak; narrow mode is higher. 350 W is 100-hour capacity."
  },
  "CBT 100LA-1 (CBT 100)": {
    manufacturer: "JBL Professional", model: "CBT 100LA-1", horizontalDeg: 150, verticalDeg: 40,
    sensitivityDb1W1m: 90, powerLongTermW: 200, impedanceOhm: 5, frequencyRangeHz: [80, 20000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 115, maxSPLPeakDb: 121, maxSPLSource: "manufacturer_published",
    drivers: "16 × 50 mm (2 in) full-range",
    source: "https://jblpro.com/en-US/products/cbt-100la-1",
    sourceNote: "JBL official spec: vertical switchable 15° narrow / 40° broad, 150° H. Broad music mode sensitivity 90 dB and 115 dB continuous average / 121 dB peak; narrow mode is higher. 200 W is 100-hour capacity. 5 Ω is specified in Thru mode; transformer taps 120/60/30 W (15 W at 70 V only)."
  },
  "Bose MA12": {
    manufacturer: "Bose Professional", model: "Panaray MA12", horizontalDeg: 145, verticalDeg: 20,
    sensitivityDb1W1m: 88, powerLongTermW: 300, impedanceOhm: 8, frequencyRangeHz: [100, 16000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 113, maxSPLPeakDb: 119, maxSPLSource: "calculated_estimate",
    drivers: "12 × 2.25 in (57 mm) mid/high-frequency drivers",
    dimensionsMm: [984, 105, 128], weightKg: 8.5,
    source: "https://www.boseprofessional.com/products/loudspeakers/line-columns/passive/ma/ma12-modular-columnar-array-loudspeaker",
    sourceNote: "Bose Professional official product specification. Single module coverage 145° H × 20° nominal; vertical pattern changes when modules are stacked. Use Bose Professional loudspeaker EQ; mid/high column normally needs bass management."
  },
  "Bose MA12EX": {
    manufacturer: "Bose Professional", model: "Panaray MA12EX", horizontalDeg: 160, verticalDeg: 20,
    sensitivityDb1W1m: 87, powerLongTermW: 150, impedanceOhm: 8, frequencyRangeHz: [58, 16000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 112, maxSPLPeakDb: 118, maxSPLSource: "calculated_estimate",
    drivers: "12 × 2.25 in (57 mm) weather-resistant high-excursion drivers",
    dimensionsMm: [985, 104, 139], weightKg: 9.4,
    source: "https://www.boseprofessional.com/products/loudspeakers/line-columns/passive/ma/ma12ex-modular-columnar-array-loudspeaker",
    sourceNote: "Bose Professional official specification. Horizontal coverage 160°; vertical coverage varies with array configuration. Recommended Bose Professional loudspeaker EQ."
  },
  "Bose 402 Series IV": {
    manufacturer: "Bose Professional", model: "Panaray 402 Series IV", horizontalDeg: 120, verticalDeg: 60,
    sensitivityDb1W1m: 91, powerLongTermW: 120, impedanceOhm: 8, frequencyRangeHz: [73, 15000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 112, maxSPLPeakDb: 118, maxSPLSource: "calculated_estimate",
    drivers: "4 × 4.5 in (114 mm) full-range cone drivers",
    dimensionsMm: [592, 206, 202], weightKg: 7.3, highPassHz: 75,
    source: "https://assets.boseprofessional.com/m/50836c8f81ac089d/original/ig_Panaray_402-IV_502A_802IV_en.pdf",
    sourceNote: "Bose Series IV installation guide, technical table p.21. 120 W extended-lifecycle rating; AES component test is 150 W. Calculated max SPL 112 dB continuous / 118 dB peak. Active EQ required; HPF 75 Hz minimum 12 dB/oct."
  },
  "Bose 802 Series IV": {
    manufacturer: "Bose Professional", model: "Panaray 802 Series IV", horizontalDeg: 120, verticalDeg: 100,
    sensitivityDb1W1m: 92, powerLongTermW: 240, impedanceOhm: 8, frequencyRangeHz: [52, 15000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 116, maxSPLPeakDb: 122, maxSPLSource: "calculated_estimate",
    drivers: "8 × 4.5 in full-range cone drivers",
    dimensionsMm: [336, 523, 335], weightKg: 13.6, highPassHz: 55,
    source: "https://assets.boseprofessional.com/m/50836c8f81ac089d/original/ig_Panaray_402-IV_502A_802IV_en.pdf",
    sourceNote: "Series IV only, not an unverified '802 V' revision. Bose extended-lifecycle rating 240 W (AES component test 300 W); calculated max 116 dB continuous / 122 dB peak. Active EQ required; HPF 55 Hz minimum 12 dB/oct."
  },
  "Bose 502 A": {
    manufacturer: "Bose Professional", model: "Panaray 502 A", horizontalDeg: 120, verticalDeg: 70,
    sensitivityDb1W1m: 88, powerLongTermW: 150, impedanceOhm: 8, frequencyRangeHz: [103, 15000],
    frequencyRangeTolerance: "-10 dB", maxSPLContinuousDb: 110, maxSPLPeakDb: 116, maxSPLSource: "calculated_estimate",
    drivers: "5 × 4.5 in (114 mm) full-range cone drivers",
    dimensionsMm: [603, 146, 179], weightKg: 6.8, highPassHz: 110,
    source: "https://assets.boseprofessional.com/m/50836c8f81ac089d/original/ig_Panaray_402-IV_502A_802IV_en.pdf",
    sourceNote: "Exact model is 502 A. Bose extended-lifecycle rating 150 W (AES component test 200 W); calculated max 110 dB continuous / 116 dB peak. Active EQ required; HPF 110 Hz minimum 12 dB/oct; indoor use only."
  },
  "Inter-M CU-7120": {
    manufacturer: "Inter-M", model: "CU-7120", horizontalDeg: 150, verticalDeg: 50,
    sensitivityDb1W1m: 94, powerLongTermW: 120, impedanceOhm: 8, frequencyRangeHz: [70, 20000],
    frequencyRangeTolerance: "-20%", maxSPLContinuousDb: 115, maxSPLSource: "calculated_estimate",
    drivers: "4 × 4 in LF + 2 × 1 in HF", dimensionsMm: [620, 130, 195], weightKg: 8,
    powerTapsW: [120, 60],
    source: "https://www.inter-m.com/en/mo/product/pdc_detail.php?pdCode=P010805_0016",
    sourceNote: "Official Inter-M page: 70 Hz–20 kHz (-20%), 94 dB (1 W/1 m), 120 W IEC, 8 Ω low-Z or 100 V taps 120/60 W. Coverage: 150° H × 50° V at 1 kHz; 70° × 20° at 4 kHz."
  },
  "Inter-M CU-7060": {
    manufacturer: "Inter-M", model: "CU-7060", horizontalDeg: 140, verticalDeg: 100,
    sensitivityDb1W1m: 92, powerLongTermW: 60, impedanceOhm: 8, frequencyRangeHz: [55, 20000],
    frequencyRangeTolerance: "-20%", maxSPLContinuousDb: 110, maxSPLSource: "calculated_estimate",
    drivers: "2 × 4 in LF + 1 × 1 in HF", dimensionsMm: [420, 130, 195], weightKg: 5.4,
    powerTapsW: [60, 30],
    source: "https://www.inter-m.com/en/mo/product/pdc_detail.php?pdCode=P010805_0015",
    sourceNote: "Official Inter-M page: 55 Hz–20 kHz (-20%), 92 dB (1 W/1 m), 60 W IEC, 8 Ω low-Z or 100 V taps 60/30 W. Coverage: 140° H × 100° V at 1 kHz; 180° × 100° at 4 kHz."
  },
  "TOA BS-1030": {
    manufacturer: "TOA", model: "BS-1030B / BS-1030W", horizontalDeg: null, verticalDeg: null,
    sensitivityDb1W1m: 90, powerLongTermW: 30, impedanceOhm: 8, frequencyRangeHz: [80, 20000],
    frequencyRangeTolerance: "manufacturer frequency response", drivers: "12 cm cone woofer + 2.5 cm dome tweeter",
    dimensionsMm: [290, 196, 150], powerTapsW: [30, 20, 15, 10, 5],
    source: "https://www.toa-products.com/international/download/specification/BS-1030B_Datasheet_en.pdf",
    sourceNote: "Official TOA datasheet: 30 W rated input, 8 Ω direct or 70/100 V transformer taps (30/20/15/10/5 W), 90 dB (1 W/1 m), 80 Hz–20 kHz. IPX4. No single nominal coverage angle published."
  }
};

export const SPEAKER_MODELS = [
  "CBT 50LA-1 (CBT 50)", "CBT 70J-1 (CBT 70)", "CBT 100LA-1 (CBT 100)",
  "Column 600 (brand/model required)", "Column 800 (brand/model required)",
  "Bose MA12", "Bose MA12EX", "Bose 402 Series IV", "Bose 402 V (verify exact revision)",
  "Bose 802 Series IV", "Bose 802 V (verify exact revision)", "Bose 502 A",
  "Bose 502 (verify exact revision)", "Inter-M CU-7120", "Inter-M CU-7060",
  "TOA BS-1030", "Khác / nhập thủ công"
] as const;

// Unverified model names intentionally have no guessed technical values.
