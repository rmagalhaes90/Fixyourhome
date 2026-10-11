import assert from "node:assert/strict";
import test from "node:test";
import { buildPlan } from "../app/lib/plan.mjs";
import { signalsFromRgba } from "../mobile/pixels.mjs";

test("a dark photo on the iPhone asks to open the light", () => {
  const dark = new Uint8Array(64 * 40 * 4);
  const signals = signalsFromRgba(dark, 64, 40);
  const plan = buildPlan(signals, "normal");
  assert.equal(plan.tasks[0].id, "lights");
  assert.match(plan.insightTitle, /luz/i);
});

test("a bright flat photo on the iPhone does not start with the light", () => {
  const bright = new Uint8Array(48 * 48 * 4);
  bright.fill(210);
  const signals = signalsFromRgba(bright, 48, 48);
  const plan = buildPlan(signals, "quick");
  assert.notEqual(plan.tasks[0].id, "lights");
});
