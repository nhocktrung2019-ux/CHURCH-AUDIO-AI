export type RoomPoint = { x: number; y: number };
export type RoomFurnitureBounds = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rotation: number;
};

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function clampRoomPoint(
  x: number,
  y: number,
  length: number,
  width: number,
  paddingX = 0,
  paddingY = 0,
): RoomPoint {
  const safeLength = Math.max(0.2, finiteOr(length, 0.2));
  const safeWidth = Math.max(0.2, finiteOr(width, 0.2));
  const padX = clamp(Math.max(0, finiteOr(paddingX, 0)), 0, safeLength / 2);
  const padY = clamp(Math.max(0, finiteOr(paddingY, 0)), 0, safeWidth / 2);
  return {
    x: clamp(finiteOr(x, safeLength / 2), padX, safeLength - padX),
    y: clamp(finiteOr(y, safeWidth / 2), padY, safeWidth - padY),
  };
}

export function rotatedHalfExtents(
  width: number,
  depth: number,
  rotationDegrees: number,
): RoomPoint {
  const radians = finiteOr(rotationDegrees, 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const safeWidth = Math.max(0, finiteOr(width, 0));
  const safeDepth = Math.max(0, finiteOr(depth, 0));
  return {
    x: (cosine * safeWidth + sine * safeDepth) / 2,
    y: (sine * safeWidth + cosine * safeDepth) / 2,
  };
}

export function clampRoomObject<T extends RoomFurnitureBounds>(
  object: T,
  length: number,
  width: number,
  height: number,
): T {
  const safeLength = Math.max(0.2, finiteOr(length, 0.2));
  const safeWidth = Math.max(0.2, finiteOr(width, 0.2));
  const safeHeight = Math.max(0.2, finiteOr(height, 0.2));
  let objectWidth = clamp(finiteOr(object.w, 0.2), 0.2, safeLength);
  let objectDepth = clamp(finiteOr(object.d, 0.2), 0.2, safeWidth);
  const rotation = finiteOr(object.rotation, 0);

  let extents = rotatedHalfExtents(objectWidth, objectDepth, rotation);
  const fitScale = Math.min(
    1,
    safeLength / Math.max(0.001, extents.x * 2),
    safeWidth / Math.max(0.001, extents.y * 2),
  );
  if (fitScale < 1) {
    objectWidth = Math.max(0.2, objectWidth * fitScale);
    objectDepth = Math.max(0.2, objectDepth * fitScale);
    extents = rotatedHalfExtents(objectWidth, objectDepth, rotation);
  }

  const point = clampRoomPoint(
    object.x,
    object.y,
    safeLength,
    safeWidth,
    Math.min(extents.x, safeLength / 2),
    Math.min(extents.y, safeWidth / 2),
  );
  return {
    ...object,
    x: point.x,
    y: point.y,
    w: objectWidth,
    d: objectDepth,
    h: clamp(finiteOr(object.h, 0.2), 0.1, safeHeight),
    rotation,
  };
}

export type SpeakerCabinetKind = "column" | "sub" | "standard";

export function classifySpeakerCabinet(model: string): SpeakerCabinetKind {
  const normalized = (model || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (/subwoofer|sub/.test(normalized) || /(?:18|218)s(?:p|x)?$/.test(normalized)) {
    return "sub";
  }
  if (/cbt|ma12|column/.test(normalized)) return "column";
  return "standard";
}


export type SpeakerCabinetDimensions = {
  width: number;
  height: number;
  depth: number;
};

export function speakerCabinetDimensions(model: string): SpeakerCabinetDimensions {
  const kind = classifySpeakerCabinet(model);
  if (kind === "column") return { width: 0.28, height: 1.12, depth: 0.24 };
  if (kind === "sub") return { width: 0.62, height: 0.48, depth: 0.58 };
  return { width: 0.42, height: 0.68, depth: 0.32 };
}

export type RoomSpeakerBounds = {
  x: number;
  y: number;
  z: number;
  model: string;
};

export function clampRoomSpeaker<T extends RoomSpeakerBounds>(
  speaker: T,
  length: number,
  width: number,
  height: number,
): T {
  const dimensions = speakerCabinetDimensions(speaker.model);
  const clearance = Math.max(dimensions.width, dimensions.depth) / 2;
  const point = clampRoomPoint(
    speaker.x,
    speaker.y,
    length,
    width,
    clearance,
    clearance,
  );
  const safeHeight = Math.max(0.2, finiteOr(height, 0.2));
  const halfHeight = Math.min(dimensions.height / 2, safeHeight / 2);
  return {
    ...speaker,
    ...point,
    z: clamp(
      finiteOr(speaker.z, halfHeight),
      halfHeight,
      safeHeight - halfHeight,
    ),
  };
}
