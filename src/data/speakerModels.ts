export type SpeakerSpec={
 manufacturer:string;model:string;horizontalDeg:number|null;verticalDeg:number|null;
 sensitivityDb1W1m:number|null;powerLongTermW:number|null;impedanceOhm:number|null;
 source:string;sourceNote:string;
};
export const SPEAKER_SPECS:Record<string,SpeakerSpec>={
 "CBT 50LA-1 (CBT 50)":{manufacturer:"JBL",model:"CBT 50LA-1",horizontalDeg:150,verticalDeg:20,sensitivityDb1W1m:89,powerLongTermW:100,impedanceOhm:8,source:"https://jblpro.com/en-US/products/cbt-50la-1",sourceNote:"Music mode 89 dB at 2.83V/1m; 100 W long-term 100 h; coverage 150° H × 20° V. Speech mode sensitivity differs."},
 "CBT 70J-1 (CBT 70)":{manufacturer:"JBL",model:"CBT 70J-1",horizontalDeg:null,verticalDeg:45,sensitivityDb1W1m:null,powerLongTermW:null,impedanceOhm:null,source:"https://help.harmanpro.com/en_US/cbt-faq",sourceNote:"Vertical pattern varies by broad/narrow mode: approximately 45° broad or 25° narrow. Other values need exact datasheet."},
 "CBT 100LA-1 (CBT 100)":{manufacturer:"JBL",model:"CBT 100LA-1",horizontalDeg:150,verticalDeg:40,sensitivityDb1W1m:90,powerLongTermW:200,impedanceOhm:8,source:"https://jblpro.com/en-US/products/cbt-100la-1",sourceNote:"Sensitivity varies by voicing and frequency band; 90 dB music broad mode. Power figure from product spec; verify current revision before design."},
 "Bose MA12":{manufacturer:"Bose Professional",model:"MA12",horizontalDeg:145,verticalDeg:20,sensitivityDb1W1m:88,powerLongTermW:300,impedanceOhm:8,source:"https://boseprofessional.com/products/loudspeakers/line-columns/passive/ma/ma12-modular-columnar-array-loudspeaker",sourceNote:"Official product page: 88 dB 1W/1m, 300 W long-term, 8 Ω, 145° H × 20° V."},
 "Bose MA12EX":{manufacturer:"Bose Professional",model:"MA12EX",horizontalDeg:160,verticalDeg:20,sensitivityDb1W1m:87,powerLongTermW:150,impedanceOhm:8,source:"https://assets.bose.com/content/dam/Bose_DAM/Web/pro_global/products/loudspeakers/Panaray_MA12EX/Downloads/technical_information/tds_MA12EX_ltr_EN.pdf",sourceNote:"Technical data sheet: 87 dB 1W/1m, 150 W long-term, 8 Ω, 160° H × 20° V; vertical pattern changes with array configuration."},
 "Bose 402 Series IV":{manufacturer:"Bose Professional",model:"Panaray 402 Series IV",horizontalDeg:120,verticalDeg:60,sensitivityDb1W1m:91,powerLongTermW:120,impedanceOhm:8,source:"https://assets.boseprofessional.com/m/50836c8f81ac089d/original/ig_Panaray_402-IV_502A_802IV_en.pdf",sourceNote:"Bose extended-lifecycle continuous rating 120 W; AES component test 150 W. Sensitivity 91 dB 1W/1m."},
 "Inter-M CU-7120":{manufacturer:"Inter-M",model:"CU-7120",horizontalDeg:150,verticalDeg:50,sensitivityDb1W1m:94,powerLongTermW:120,impedanceOhm:8,source:"https://www.inter-m.com/en/mo/product/pdc_detail.php?pdCode=P010805_0016",sourceNote:"Dispersion is frequency dependent: 150°/50° at 1 kHz and 70°/20° at 4 kHz. 120 W IEC, low-Z 8 Ω."},
 "Inter-M CU-7060":{manufacturer:"Inter-M",model:"CU-7060",horizontalDeg:140,verticalDeg:100,sensitivityDb1W1m:92,powerLongTermW:60,impedanceOhm:8,source:"https://www.inter-m.com/en/mo/product/pdc_detail.php?pdCode=P010805_0015",sourceNote:"Dispersion is frequency dependent: 140°/100° at 1 kHz and 180°/100° at 4 kHz. 60 W IEC, low-Z 8 Ω."},
 "TOA BS-1030":{manufacturer:"TOA",model:"BS-1030",horizontalDeg:null,verticalDeg:null,sensitivityDb1W1m:90,powerLongTermW:30,impedanceOhm:8,source:"https://www.toa-products.com/international/download/spec/bs-1030b_cs1e.pdf",sourceNote:"90 dB 1W/1m, 30 W rated input, 8 Ω or 70/100 V taps; official source does not provide a single coverage angle."}
};
export const SPEAKER_MODELS=[
 "CBT 50LA-1 (CBT 50)","CBT 70J-1 (CBT 70)","CBT 100LA-1 (CBT 100)","Column 600","Column 800",
 "Bose MA12","Bose MA12EX","Bose 402 Series IV","Bose 402 V (verify revision)","Bose 802 V (verify revision)","Bose 502 (verify revision)",
 "Inter-M CU-7120","Inter-M CU-7060","TOA BS-1030","Khác / nhập thủ công"
] as const;
// No values are inferred for similarly named, unverified product revisions.
