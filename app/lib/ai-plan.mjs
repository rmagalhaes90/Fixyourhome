import { MODES } from "./plan.mjs";

const ICONS = ["💡", "🗑️", "🥛", "👕", "📄", "✨", "🛏️", "🧹", "🧽", "🌟"];

export function firstName(name) {
  const part = String(name ?? "").trim().split(/\s+/)[0];
  return part || "você";
}

export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "•";
}

export function authErrorMessage(code) {
  const messages = {
    google_not_configured: "O login do Google ainda não está ligado neste servidor.",
    apple_not_configured: "O login da Apple ainda não está ligado neste servidor.",
    google_failed: "Não foi possível entrar com o Google. Tente de novo.",
    apple_failed: "Não foi possível entrar com a Apple. Tente de novo.",
    sign_in_required: "Entre para a IA analisar a foto e guardar o plano na sua conta.",
  };
  return messages[code] ?? "Não foi possível entrar.";
}

export function previousDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function streakFromDays(days, today) {
  const done = new Set(days);
  let cursor = done.has(today) ? today : previousDay(today);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

function cleanText(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function asObject(value) {
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(trimmed);
  }
  return value;
}

/**
 * @param {unknown} raw
 * @param {"quick"|"normal"|"deep"} mode
 */
export function planFromAi(raw, mode) {
  const body = asObject(raw);
  if (!body || typeof body !== "object") throw new Error("A IA não devolveu um plano.");
  const limit = MODES[mode].count;
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const planned = tasks.slice(0, limit).map((task, index) => {
    const title = cleanText(task?.title, 80);
    const detail = cleanText(task?.detail, 240);
    const minutes = Math.max(1, Math.min(20, Math.round(Number(task?.minutes) || 1)));
    const icon = cleanText(task?.icon, 8) || ICONS[index % ICONS.length];
    if (title.length < 2 || detail.length < 2) throw new Error("A IA devolveu um passo incompleto.");
    return { id: `ai-${index + 1}`, title, detail, minutes, icon };
  });
  if (planned.length < Math.min(3, limit)) throw new Error("A IA devolveu poucos passos.");
  const notes = (Array.isArray(body.notes) ? body.notes : [])
    .map((note) => cleanText(note, 40))
    .filter((note) => note.length > 1)
    .slice(0, 4);
  const insightTitle = cleanText(body.insightTitle, 80);
  const insightBody = cleanText(body.insightBody, 280);
  if (insightTitle.length < 2 || insightBody.length < 2) throw new Error("A IA não explicou o plano.");
  const beforeScore = Math.max(18, Math.min(88, Math.round(Number(body.beforeScore) || 40)));
  return {
    tasks: planned,
    totalMinutes: planned.reduce((sum, task) => sum + task.minutes, 0),
    beforeScore,
    insightTitle,
    insightBody,
    notes: notes.length ? notes : ["Leitura da IA"],
  };
}
