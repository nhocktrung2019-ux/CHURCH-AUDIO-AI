export type RoomDimensions = { lengthM: number; widthM: number; heightM: number };
export type MeasurementPosition = {
  id: string; roomId: string; zoneId: string; label: string;
  xM: number; yM: number; zM: number; createdAt: string; note?: string;
};
export type PositionValidation = { valid: boolean; errors: string[] };

const finite = (n: number) => Number.isFinite(n);
export function validateRoomDimensions(room: RoomDimensions): PositionValidation {
  const errors: string[] = [];
  if (!finite(room.lengthM) || room.lengthM < 2 || room.lengthM > 200) errors.push("Chiều dài phòng phải từ 2 đến 200 m.");
  if (!finite(room.widthM) || room.widthM < 2 || room.widthM > 120) errors.push("Chiều rộng phòng phải từ 2 đến 120 m.");
  if (!finite(room.heightM) || room.heightM < 2 || room.heightM > 50) errors.push("Chiều cao phòng phải từ 2 đến 50 m.");
  return { valid: errors.length === 0, errors };
}
export function validateMeasurementPosition(position: MeasurementPosition, room: RoomDimensions): PositionValidation {
  const errors = [...validateRoomDimensions(room).errors];
  if (!position.id.trim() || !position.roomId.trim() || !position.zoneId.trim() || !position.label.trim()) errors.push("ID, phòng, vùng và tên vị trí là bắt buộc.");
  if (position.roomId.trim() === "") errors.push("Mã phòng không hợp lệ.");
  for (const [label, value, max] of [["X", position.xM, room.lengthM], ["Y", position.yM, room.widthM], ["Z", position.zM, room.heightM]] as const) {
    if (!finite(value) || value < 0 || value > max) errors.push(`Tọa độ ${label} phải nằm trong phòng (0–${max} m).`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
export function upsertMeasurementPosition(items: MeasurementPosition[], next: MeasurementPosition, room: RoomDimensions): MeasurementPosition[] {
  const result = validateMeasurementPosition(next, room);
  if (!result.valid) throw new Error(result.errors.join(" "));
  const duplicate = items.find((item) => item.id === next.id && item.roomId !== next.roomId);
  if (duplicate) throw new Error("ID vị trí đã được dùng ở phòng khác.");
  return [...items.filter((item) => item.id !== next.id), { ...next, label: next.label.trim(), zoneId: next.zoneId.trim() }];
}
export function distance3dMeters(a: Pick<MeasurementPosition, "xM"|"yM"|"zM">, b: Pick<MeasurementPosition, "xM"|"yM"|"zM">): number {
  return Math.hypot(a.xM-b.xM, a.yM-b.yM, a.zM-b.zM);
}
