import assert from "node:assert/strict";
import test from "node:test";
import {
  AFFIRMATIONS,
  afterScore,
  buildPlan,
  closingLine,
  finishBonus,
  finishClock,
  formatDuration,
  greeting,
  lastLabel,
  pointsForStep,
  recordReset,
  signalsFromPixels,
} from "../app/lib/plan.mjs";

function solid(size, [r, g, b]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

function noisy(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    const i = p * 4;
    const band = (p * 17) % 5;
    const colors = [
      [210, 40, 40],
      [30, 40, 180],
      [240, 220, 30],
      [20, 20, 20],
      [250, 250, 250],
    ];
    const [r, g, b] = colors[band];
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

test("a flat bright photo reads as calm and a noisy photo reads as full", () => {
  const calm = signalsFromPixels(solid(16, [210, 214, 208]), 16);
  const busy = signalsFromPixels(noisy(16), 16);
  assert.ok(calm.clutter < 0.2);
  assert.ok(calm.brightness > 0.7);
  assert.ok(busy.clutter > calm.clutter);
  assert.ok(busy.colorfulness > calm.colorfulness);
});

test("a dark photo puts light first and a colorful photo talks about color", () => {
  const dark = buildPlan({ brightness: 0.12, clutter: 0.7, colorfulness: 0.2, warm: 0.1, floorClutter: 0.3 }, "normal");
  assert.equal(dark.tasks[0].id, "lights");
  assert.equal(dark.insightTitle, "Primeiro, mais luz");
  assert.ok(dark.notes.includes("Luz baixa"));

  const colorful = buildPlan({ brightness: 0.7, clutter: 0.66, colorfulness: 0.8, warm: 0.7, floorClutter: 0.2 }, "normal");
  assert.equal(colorful.insightTitle, "O maior impacto visual");
  assert.ok(colorful.tasks.some((task) => task.id === "clothes"));
  assert.ok(colorful.tasks.at(-1).id === "reset");
});

test("each mode keeps a short ordered list with a finish time", () => {
  const signals = { brightness: 0.64, clutter: 0.48, colorfulness: 0.22, warm: 0.3, floorClutter: 0.2 };
  const quick = buildPlan(signals, "quick");
  const deep = buildPlan(signals, "deep");
  assert.equal(quick.tasks.length, 3);
  assert.equal(deep.tasks.length, 6);
  assert.ok(deep.totalMinutes > quick.totalMinutes);
  assert.ok(quick.tasks.every((task) => task.minutes >= 1));
  const start = new Date(2026, 9, 10, 13, 38);
  assert.equal(finishClock(start, quick.totalMinutes), formatExpected(start, quick.totalMinutes));
});

test("rewards, affirmations and the clock follow the work", () => {
  assert.equal(pointsForStep(true, 40, 2), 15);
  assert.equal(pointsForStep(true, 500, 2), 10);
  assert.equal(pointsForStep(false, 10, 2), 4);
  assert.equal(finishBonus(3, 3, 120, 10), 30);
  assert.equal(afterScore(40, 3, 3), 99);
  assert.match(closingLine(3, 3, true), /no tempo/);
  assert.equal(AFFIRMATIONS.length >= 4, true);
  assert.equal(greeting(new Date(2026, 9, 10, 9, 0)), "BOM DIA");
  assert.equal(greeting(new Date(2026, 9, 10, 15, 0)), "BOA TARDE");
  assert.equal(greeting(new Date(2026, 9, 10, 21, 0)), "BOA NOITE");
  assert.equal(formatDuration(75), "01:15");
});

test("a finished reset updates streak, minutes and the last-clean label", () => {
  const now = new Date(2026, 9, 10, 18, 5);
  const first = recordReset({ real: false, streak: 4, minutes: 54, resets: 3, score: 86 }, { minutes: 12, score: 90, now });
  assert.equal(first.real, true);
  assert.equal(first.streak, 1);
  assert.equal(first.minutes, 12);
  assert.equal(first.resets, 1);
  const next = recordReset(first, { minutes: 8, score: 94, now: new Date(2026, 9, 11, 9, 0) });
  assert.equal(next.streak, 2);
  assert.equal(next.minutes, 20);
  assert.equal(lastLabel(next, new Date(2026, 9, 11, 12, 0)), "Última organização hoje");
  assert.equal(lastLabel(next, new Date(2026, 9, 12, 12, 0)), "Última organização ontem");
});

function formatExpected(date, minutes) {
  const end = new Date(date.getTime() + minutes * 60000);
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}
