export interface LeqLevels {
  z: number;
  a: number;
  c: number;
}

export interface LeqIntegrationState extends LeqLevels {
  seconds: number;
  lastTime: number | null;
}

const MIN_LEVEL_DB = -100;
const MAX_LEVEL_DB = 0;

export function createLeqIntegrationState(): LeqIntegrationState {
  return { z: 0, a: 0, c: 0, seconds: 0, lastTime: null };
}

/**
 * Integrates squared acoustic pressure (represented as relative energy) over
 * elapsed time. Returns the accepted interval, or null when there is no valid
 * interval to integrate. A large scheduler gap is deliberately discarded.
 */
export function integrateLeqSample(
  state: LeqIntegrationState,
  levels: LeqLevels,
  nowSeconds: number,
  maxIntervalSeconds = 0.25,
): number | null {
  if (!Number.isFinite(nowSeconds)) return null;

  const previousTime = state.lastTime;
  state.lastTime = nowSeconds;
  if (previousTime === null) return null;

  const elapsed = nowSeconds - previousTime;
  if (
    !Number.isFinite(elapsed) ||
    elapsed <= 0 ||
    !Number.isFinite(maxIntervalSeconds) ||
    maxIntervalSeconds <= 0 ||
    elapsed > maxIntervalSeconds ||
    !Number.isFinite(levels.z) ||
    !Number.isFinite(levels.a) ||
    !Number.isFinite(levels.c)
  ) {
    return null;
  }

  const z = Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, levels.z));
  const a = Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, levels.a));
  const c = Math.min(MAX_LEVEL_DB, Math.max(MIN_LEVEL_DB, levels.c));

  state.z += Math.pow(10, z / 10) * elapsed;
  state.a += Math.pow(10, a / 10) * elapsed;
  state.c += Math.pow(10, c / 10) * elapsed;
  state.seconds += elapsed;

  return elapsed;
}

export function getLeqLevels(state: LeqIntegrationState): LeqLevels {
  if (!(state.seconds > 0) || !Number.isFinite(state.seconds)) {
    return { z: MIN_LEVEL_DB, a: MIN_LEVEL_DB, c: MIN_LEVEL_DB };
  }

  const toDecibels = (energySeconds: number) =>
    energySeconds > 0 && Number.isFinite(energySeconds)
      ? 10 * Math.log10(energySeconds / state.seconds)
      : MIN_LEVEL_DB;

  return {
    z: toDecibels(state.z),
    a: toDecibels(state.a),
    c: toDecibels(state.c),
  };
}
