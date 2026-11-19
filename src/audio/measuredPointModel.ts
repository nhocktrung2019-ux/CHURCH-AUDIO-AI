export type CalibrationState = "calibrated" | "uncalibrated";
export type Weighting = "A" | "C" | "Z";

export type MeasuredPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  splDb: number | null;
  calibration: CalibrationState;
  weighting: Weighting;
  inputLabel: string;
  note: string;
  capturedAt: string;
};

export type RoomBounds = { length: number; width: number; height: number };

export const isMeasuredPointInsideRoom = (point: MeasuredPoint, room: RoomBounds): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) &&
  Number.isFinite(room.length) && Number.isFinite(room.width) && Number.isFinite(room.height) &&
  point.x >= 0 && point.x <= room.length &&
  point.y >= 0 && point.y <= room.width &&
  point.z >= 0 && point.z <= room.height;

export const isValidMeasuredSpl = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0 && value <= 160;

export const getVerifiedMeasuredPoints = (points: readonly MeasuredPoint[], room: RoomBounds): MeasuredPoint[] =>
  points.filter((point) =>
    isMeasuredPointInsideRoom(point, room) &&
    point.calibration === "calibrated" &&
    isValidMeasuredSpl(point.splDb),
  );
