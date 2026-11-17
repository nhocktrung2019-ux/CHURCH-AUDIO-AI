export type ChannelCaptureMetadata = {
  captureSessionId: string;
  clockDomainId: string;
  sourceStreamId: string;
  sampleRate: number;
  frameStart: number;
  frameCount: number;
  channelIndex: number;
};

export type SynchronousPairValidation =
  | { valid: true; sampleRate: number; frameStart: number; frameCount: number; referenceChannel: number; measurementChannel: number }
  | { valid: false; reason: string };

/**
 * Validate two channels from one capture block. Matching labels alone do not
 * prove hardware synchronization; the caller must only assign a shared clock
 * domain when both channels came from the same multichannel stream/worklet.
 */
export function validateSynchronousChannelPair(
  reference: ChannelCaptureMetadata,
  measurement: ChannelCaptureMetadata,
): SynchronousPairValidation {
  if (!reference.captureSessionId || !measurement.captureSessionId
    || !reference.clockDomainId || !measurement.clockDomainId
    || !reference.sourceStreamId || !measurement.sourceStreamId) {
    return { valid: false, reason: "Missing capture-session, clock-domain or source-stream identity." };
  }
  if (reference.captureSessionId !== measurement.captureSessionId) {
    return { valid: false, reason: "Channels were not captured in the same session." };
  }
  if (reference.clockDomainId !== measurement.clockDomainId) {
    return { valid: false, reason: "Independent sample clocks cannot be used for phase/delay alignment." };
  }
  if (reference.sourceStreamId !== measurement.sourceStreamId) {
    return { valid: false, reason: "Reference and measurement must come from the same multichannel input stream." };
  }
  if (!Number.isFinite(reference.sampleRate) || reference.sampleRate <= 0
    || reference.sampleRate !== measurement.sampleRate) {
    return { valid: false, reason: "Channel sample rates do not match." };
  }
  if (!Number.isSafeInteger(reference.frameStart) || reference.frameStart < 0
    || reference.frameStart !== measurement.frameStart) {
    return { valid: false, reason: "Channel frame positions are not synchronous." };
  }
  if (!Number.isSafeInteger(reference.frameCount) || reference.frameCount <= 0
    || reference.frameCount !== measurement.frameCount) {
    return { valid: false, reason: "Channel frame counts do not match." };
  }
  if (!Number.isInteger(reference.channelIndex) || reference.channelIndex < 0
    || !Number.isInteger(measurement.channelIndex) || measurement.channelIndex < 0
    || reference.channelIndex === measurement.channelIndex) {
    return { valid: false, reason: "Reference and measurement must select two distinct valid channels." };
  }
  return {
    valid: true,
    sampleRate: reference.sampleRate,
    frameStart: reference.frameStart,
    frameCount: reference.frameCount,
    referenceChannel: reference.channelIndex,
    measurementChannel: measurement.channelIndex,
  };
}

/** Copy two planar channels only when both contain the exact same frame range. */
export function extractSynchronousPlanarPair(
  channels: readonly Float32Array[],
  frameCount: number,
  referenceChannel: number,
  measurementChannel: number,
): { valid: true; reference: Float32Array; measurement: Float32Array } | { valid: false; reason: string } {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    return { valid: false, reason: "Invalid synchronized frame count." };
  }
  if (!Number.isInteger(referenceChannel) || !Number.isInteger(measurementChannel)
    || referenceChannel < 0 || measurementChannel < 0
    || referenceChannel === measurementChannel
    || referenceChannel >= channels.length || measurementChannel >= channels.length) {
    return { valid: false, reason: "Selected channels are unavailable or not distinct." };
  }
  const referenceInput = channels[referenceChannel];
  const measurementInput = channels[measurementChannel];
  if (!(referenceInput instanceof Float32Array) || !(measurementInput instanceof Float32Array)
    || referenceInput.length !== frameCount || measurementInput.length !== frameCount) {
    return { valid: false, reason: "Selected channels do not contain the same complete frame range." };
  }
  return {
    valid: true,
    reference: new Float32Array(referenceInput),
    measurement: new Float32Array(measurementInput),
  };
}

function correlationAtLag(reference: Float32Array, measurement: Float32Array, lag: number, step: number): number {
  let xy = 0, xx = 0, yy = 0;
  const startReference = Math.max(0, -lag);
  const endReference = Math.min(reference.length, measurement.length - lag);
  for (let i = startReference; i < endReference; i += step) {
    const x = reference[i];
    const y = measurement[i + lag];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    xy += x * y;
    xx += x * x;
    yy += y * y;
  }
  return xx > 1e-15 && yy > 1e-15 ? xy / Math.sqrt(xx * yy) : 0;
}

/**
 * Estimate relative arrival delay from synchronized broadband channels.
 * Positive delay means the measurement channel arrives after the reference.
 * This is a signal estimate, not an acoustic calibration or proof of routing.
 */
export function estimateSynchronousRelativeDelay(
  reference: Float32Array,
  measurement: Float32Array,
  sampleRate: number,
  maxDelayMs = 100,
): { delaySamples: number; delayMs: number; correlation: number } | null {
  if (reference.length < 1024 || measurement.length < 1024
    || !Number.isFinite(sampleRate) || sampleRate < 8000
    || !Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > 500) return null;
  const limit = Math.min(Math.floor(sampleRate * maxDelayMs / 1000), Math.floor(Math.min(reference.length, measurement.length) / 2));
  if (limit < 1) return null;

  const coarseStep = 4;
  let coarseLag = 0, coarseScore = 0;
  for (let lag = -limit; lag <= limit; lag++) {
    const score = Math.abs(correlationAtLag(reference, measurement, lag, coarseStep));
    if (score > coarseScore) { coarseScore = score; coarseLag = lag; }
  }
  let bestLag = coarseLag, bestScore = 0;
  for (let lag = Math.max(-limit, coarseLag - coarseStep); lag <= Math.min(limit, coarseLag + coarseStep); lag++) {
    const score = Math.abs(correlationAtLag(reference, measurement, lag, 1));
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  if (bestScore < 0.1) return null;

  const ym = Math.abs(correlationAtLag(reference, measurement, bestLag - 1, 1));
  const y0 = Math.abs(correlationAtLag(reference, measurement, bestLag, 1));
  const yp = Math.abs(correlationAtLag(reference, measurement, bestLag + 1, 1));
  const denominator = ym - 2 * y0 + yp;
  const fraction = Math.abs(denominator) > 1e-12
    ? Math.max(-0.5, Math.min(0.5, 0.5 * (ym - yp) / denominator))
    : 0;
  const delaySamples = bestLag + fraction;
  return { delaySamples, delayMs: delaySamples / sampleRate * 1000, correlation: bestScore };
}
