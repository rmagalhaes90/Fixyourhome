import assert from "node:assert/strict";
import test from "node:test";
import { authErrorMessage, firstName, initials, planFromAi, streakFromDays } from "../app/lib/ai-plan.mjs";

const sample = {
  insightTitle: "Roupas primeiro",
  insightBody: "A cama e o chão estão cobertos. Recolher isso muda a foto.",
  notes: ["Muita roupa", "Chão ocupado"],
  beforeScore: 30,
  tasks: [
    { title: "Abra a luz", detail: "A foto está escura.", minutes: 1, icon: "💡" },
    { title: "Junte as roupas", detail: "Faça uma pilha só.", minutes: 6, icon: "👕" },
    { title: "Liberte a cama", detail: "Deixe o colchão à vista.", minutes: 4, icon: "🛏️" },
    { title: "Abra o caminho", detail: "Junte o que está no chão.", minutes: 5, icon: "🧹" },
    { title: "Reset final", detail: "Olhe o quarto da porta.", minutes: 3, icon: "🌟" },
    { title: "Extra", detail: "Este passo passa do limite rápido.", minutes: 9, icon: "✨" },
  ],
};

test("the AI plan follows the chosen pace and keeps the words", () => {
  const quick = planFromAi(sample, "quick");
  assert.equal(quick.tasks.length, 3);
  assert.equal(quick.tasks[1].title, "Junte as roupas");
  assert.equal(quick.totalMinutes, 11);
  assert.equal(quick.insightTitle, "Roupas primeiro");
  assert.deepEqual(quick.notes, ["Muita roupa", "Chão ocupado"]);

  const wrapped = planFromAi("```json\n" + JSON.stringify(sample) + "\n```", "normal");
  assert.equal(wrapped.tasks.length, 5);
});

test("a broken AI reply is rejected", () => {
  assert.throws(() => planFromAi({ tasks: [] }, "normal"));
  assert.throws(() => planFromAi("não é json", "quick"));
});

test("names, sign-in errors and streaks are readable", () => {
  assert.equal(firstName("Ramon Magalhaes"), "Ramon");
  assert.equal(initials("Ramon Magalhaes"), "RM");
  assert.match(authErrorMessage("google_not_configured"), /Google/);
  assert.equal(streakFromDays(["2026-10-09", "2026-10-10"], "2026-10-10"), 2);
  assert.equal(streakFromDays(["2026-10-08", "2026-10-09"], "2026-10-10"), 2);
  assert.equal(streakFromDays(["2026-10-01"], "2026-10-10"), 0);
});
