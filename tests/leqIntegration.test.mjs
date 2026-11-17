import test from "node:test";
import assert from "node:assert/strict";
import {
  createLeqIntegrationState,
  getLeqLevels,
  integrateLeqSample,
} from "../src/audio/leqIntegration.ts";

const near = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test("the first sample establishes a clock without inventing an interval", () => {
  const state = createLeqIntegrationState();
  assert.equal(integrateLeqSample(state, { z: -20, a: -21, c: -19 }, 1), null);
  assert.equal(state.seconds, 0);
  assert.deepEqual(getLeqLevels(state), { z: -100, a: -100, c: -100 });
});

test("constant level is independent of the sample/update frequency", () => {
  const fast = createLeqIntegrationState();
  const slow = createLeqIntegrationState();
  integrateLeqSample(fast, { z: -20, a: -21, c: -19 }, 0);
  for (let i = 1; i <= 100; i++) {
    integrateLeqSample(fast, { z: -20, a: -21, c: -19 }, i / 1000);
  }
  integrateLeqSample(slow, { z: -20, a: -21, c: -19 }, 0);
  for (let i = 1; i <= 10; i++) {
    integrateLeqSample(slow, { z: -20, a: -21, c: -19 }, i / 100);
  }

  const fastLeq = getLeqLevels(fast);
  const slowLeq = getLeqLevels(slow);
  near(fastLeq.z, -20);
  near(fastLeq.a, -21);
  near(fastLeq.c, -19);
  near(slowLeq.z, -20);
  near(slowLeq.a, -21);
  near(slowLeq.c, -19);
  near(fastLeq.z, slowLeq.z);
});

test("averages acoustic energy rather than averaging decibel values", () => {
  const state = createLeqIntegrationState();
  integrateLeqSample(state, { z: -20, a: -20, c: -20 }, 0);
  integrateLeqSample(state, { z: -20, a: -20, c: -20 }, 0.1);
  integrateLeqSample(state, { z: -40, a: -40, c: -40 }, 0.2);

  const expected = 10 * Math.log10((Math.pow(10, -20 / 10) + Math.pow(10, -40 / 10)) / 2);
  near(getLeqLevels(state).z, expected);
  assert.ok(Math.abs(getLeqLevels(state).z - -30) > 6);
});

test("discards long scheduler gaps but resumes integration after the gap", () => {
  const state = createLeqIntegrationState();
  const level = { z: -30, a: -30, c: -30 };
  integrateLeqSample(state, level, 0);
  integrateLeqSample(state, level, 0.1);
  assert.equal(integrateLeqSample(state, level, 0.8), null);
  assert.equal(state.seconds, 0.1);
  integrateLeqSample(state, level, 0.9);
  near(state.seconds, 0.2);
  near(getLeqLevels(state).z, -30);
});

test("rejects reversed timestamps and non-finite levels without poisoning state", () => {
  const state = createLeqIntegrationState();
  integrateLeqSample(state, { z: -25, a: -25, c: -25 }, 2);
  assert.equal(integrateLeqSample(state, { z: -25, a: -25, c: -25 }, 1.9), null);
  assert.equal(
    integrateLeqSample(state, { z: Number.NaN, a: -25, c: -25 }, 2.0),
    null,
  );
  integrateLeqSample(state, { z: -25, a: -25, c: -25 }, 2.1);
  near(state.seconds, 0.1);
  near(getLeqLevels(state).z, -25);
});
