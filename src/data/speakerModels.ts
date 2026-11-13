export const SPEAKER_MODELS=[
 "CBT 50","CBT 70","CBT 100","Column 600","Column 800","MA12","MA12 EX",
 "Bose 402 IV","Bose 402 V","Bose 802 V","Bose 502","Inter-M CU7120","Inter-M CU7060","TOA BS1030","Khác / nhập thủ công"
] as const;
export type SpeakerModel=typeof SPEAKER_MODELS[number];
// Manufacturer sensitivity, impedance, power and beamwidth values are intentionally not guessed.
// Populate only from the exact model revision's official datasheet or calibrated measurement.
