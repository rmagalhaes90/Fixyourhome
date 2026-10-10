/** @typedef {"quick" | "normal" | "deep"} Mode */

/**
 * @typedef {Object} PhotoSignals
 * @property {number} brightness
 * @property {number} clutter
 * @property {number} colorfulness
 * @property {number} warm
 * @property {number} floorClutter
 */

export const MODES = {
  quick: { title: "Reset rápido", hint: "5–8 min", count: 3 },
  normal: { title: "Organização completa", hint: "15–25 min", count: 5 },
  deep: { title: "Limpeza profunda", hint: "45–60 min", count: 6 },
};

const ORDER = ["lights", "trash", "dishes", "clothes", "papers", "surfaces", "bed", "floor", "dust", "reset"];

const CATALOG = [
  { id: "lights", title: "Abra a luz e as cortinas", detail: "Enxergar o cômodo já deixa o próximo passo mais fácil.", minutes: 1, icon: "💡" },
  { id: "trash", title: "Recolha o lixo", detail: "Pegue embalagens, papéis e o que já pode ir embora.", minutes: 3, icon: "🗑️" },
  { id: "dishes", title: "Leve copos e pratos", detail: "Junte a louça e deixe na pia. Lavar pode ficar para depois.", minutes: 3, icon: "🥛" },
  { id: "clothes", title: "Junte as roupas", detail: "Sujas no cesto. Limpas numa pilha só, para guardar depois.", minutes: 4, icon: "👕" },
  { id: "papers", title: "Empilhe papéis e objetos miúdos", detail: "Uma pilha só. Decidir o que guardar fica para outro momento.", minutes: 4, icon: "📄" },
  { id: "surfaces", title: "Libere uma superfície", detail: "Escolha a mesa ou a cômoda e deixe só o que você usa hoje.", minutes: 4, icon: "✨" },
  { id: "bed", title: "Arrume a cama", detail: "Estique o lençol e coloque os travesseiros no lugar.", minutes: 4, icon: "🛏️" },
  { id: "floor", title: "Abra o caminho no chão", detail: "Junte o que está no caminho e encoste no lugar certo.", minutes: 5, icon: "🧹" },
  { id: "dust", title: "Passe um pano nas superfícies", detail: "De cima para baixo, só onde a mão alcança agora.", minutes: 6, icon: "🧽" },
  { id: "reset", title: "Faça o reset final", detail: "Guarde os últimos itens soltos e olhe o cômodo da porta.", minutes: 3, icon: "🌟" },
];

export const AFFIRMATIONS = [
  "Isso já conta. Você começou.",
  "Um pedaço do cômodo já está mais leve.",
  "Você não precisa resolver tudo. Este passo basta agora.",
  "Bom ritmo. O próximo é só mais um.",
  "Você está cuidando do seu espaço — e de você.",
  "Quase lá. O que você fez já aparece.",
];

export const SKIP_NOTE = "Tudo bem pular. O plano segue com o que você consegue agora.";

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * @param {ArrayLike<number>} data RGBA bytes
 * @param {number} size
 * @returns {PhotoSignals}
 */
export function signalsFromPixels(data, size) {
  const count = size * size;
  const lums = new Array(count);
  let satSum = 0;
  let warm = 0;
  for (let p = 0; p < count; p++) {
    const i = p * 4;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    lums[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat * lums[p];
    if (r > b + 0.04 && r > 0.15) warm++;
  }
  const mean = lums.reduce((sum, value) => sum + value, 0) / count;
  const variance = lums.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  let edge = 0;
  let floorEdge = 0;
  let floorN = 0;
  const rowStart = Math.floor(size * 0.62);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (x + 1 < size) edge += Math.abs(lums[i] - lums[i + 1]);
      if (y + 1 < size) edge += Math.abs(lums[i] - lums[i + size]);
      if (y >= rowStart && x + 1 < size) {
        floorEdge += Math.abs(lums[i] - lums[i + 1]);
        floorN++;
      }
    }
  }
  const edgeMean = edge / (count * 2);
  const floorMean = floorN ? floorEdge / floorN : edgeMean;
  return {
    brightness: clamp01(mean),
    clutter: clamp01(edgeMean * 5.5 + Math.sqrt(variance) * 1.4),
    colorfulness: clamp01((satSum / count) * 3.4),
    warm: warm / count,
    floorClutter: clamp01(floorMean * 6.2),
  };
}

function scoreTask(task, signals, mode) {
  let score = 1;
  if (task.id === "lights") score += signals.brightness < 0.38 ? 8 : -20;
  if (task.id === "clothes" || task.id === "bed") score += signals.colorfulness * 4 + signals.warm * 2;
  if (task.id === "papers") score += (1 - signals.colorfulness) * 3.2 + signals.clutter * 1.4;
  if (task.id === "dishes") score += signals.clutter * 1.6 + (1 - signals.warm) * 1.4;
  if (task.id === "surfaces") score += signals.clutter * 4;
  if (task.id === "floor") score += signals.floorClutter * 6 + (mode === "deep" ? 2 : 0);
  if (task.id === "dust") score += mode === "deep" ? 5.5 : mode === "quick" ? -4 : 0.4;
  if (task.id === "trash") score += 4.2 + signals.clutter;
  if (task.id === "reset") score += 3.4;
  if (mode === "quick" && (task.id === "dust" || task.id === "floor")) score -= 1.5;
  return score;
}

function insightFor(signals) {
  if (signals.brightness < 0.38) {
    return {
      insightTitle: "Primeiro, mais luz",
      insightBody: "A foto está escura. Abrir a luz muda o que você consegue fazer em seguida.",
    };
  }
  if (signals.floorClutter > 0.62 && signals.floorClutter > signals.clutter + 0.12) {
    return {
      insightTitle: "O chão pede passagem",
      insightBody: "A parte de baixo da foto está bem ocupada. Abrir um caminho já alivia o cômodo.",
    };
  }
  if (signals.colorfulness > 0.45) {
    return {
      insightTitle: "O maior impacto visual",
      insightBody: "A foto tem muita cor espalhada. Recolher o que está misturado muda o ambiente primeiro.",
    };
  }
  if (signals.clutter > 0.55) {
    return {
      insightTitle: "Uma superfície de cada vez",
      insightBody: "A imagem está bem cheia. Liberar uma mesa e recolher o lixo já deixa o resto mais simples.",
    };
  }
  return {
    insightTitle: "Poucos passos bastam",
    insightBody: "A bagunça está contida. Um reset curto deixa o cômodo apresentável.",
  };
}

function notesFor(signals) {
  const notes = [];
  if (signals.brightness < 0.4) notes.push("Luz baixa");
  else notes.push("Boa luz");
  if (signals.colorfulness > 0.45) notes.push("Muita cor");
  else notes.push("Pouca cor");
  if (signals.clutter > 0.55) notes.push("Visual cheio");
  else notes.push("Visual contido");
  if (signals.floorClutter > 0.55) notes.push("Chão ocupado");
  return notes;
}

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} detail
 * @property {number} minutes
 * @property {string} icon
 */

/**
 * @typedef {Object} Plan
 * @property {Task[]} tasks
 * @property {number} totalMinutes
 * @property {number} beforeScore
 * @property {string} insightTitle
 * @property {string} insightBody
 * @property {string[]} notes
 */

/**
 * @typedef {Object} History
 * @property {boolean} real
 * @property {number} streak
 * @property {number} minutes
 * @property {number} resets
 * @property {number} score
 * @property {string} [lastDay]
 */

/**
 * @param {PhotoSignals} signals
 * @param {Mode} mode
 * @returns {Plan}
 */
export function buildPlan(signals, mode) {
  const safe = {
    brightness: clamp01(signals.brightness),
    clutter: clamp01(signals.clutter),
    colorfulness: clamp01(signals.colorfulness),
    warm: clamp01(signals.warm),
    floorClutter: clamp01(signals.floorClutter),
  };
  const ranked = CATALOG.map((task) => ({ task, score: scoreTask(task, safe, mode) })).sort((a, b) => b.score - a.score);
  const picked = new Map(ranked.slice(0, MODES[mode].count).map(({ task }) => [task.id, task]));
  if (safe.brightness < 0.38) picked.set("lights", CATALOG[0]);
  picked.set("trash", CATALOG.find((task) => task.id === "trash"));
  picked.set("reset", CATALOG.find((task) => task.id === "reset"));
  while (picked.size > MODES[mode].count) {
    const drop = [...picked.keys()].filter((id) => id !== "lights" && id !== "trash" && id !== "reset").sort((a, b) => {
      const scoreA = ranked.find((item) => item.task.id === a)?.score ?? 0;
      const scoreB = ranked.find((item) => item.task.id === b)?.score ?? 0;
      return scoreA - scoreB;
    })[0];
    if (!drop) break;
    picked.delete(drop);
  }
  const pace = mode === "quick" ? 0.75 : mode === "deep" ? 1.45 : 1;
  const load = 0.9 + safe.clutter * 0.4;
  const tasks = ORDER.filter((id) => picked.has(id)).map((id) => {
    const task = picked.get(id);
    return { ...task, minutes: Math.max(1, Math.round(task.minutes * pace * load)) };
  });
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  const beforeScore = Math.round(Math.min(88, Math.max(18, 92 - safe.clutter * 55 - (1 - safe.brightness) * 16 - safe.floorClutter * 8)));
  return {
    tasks,
    totalMinutes,
    beforeScore,
    notes: notesFor(safe),
    ...insightFor(safe),
  };
}

export function afterScore(before, done, total) {
  if (!total || done <= 0) return before;
  return Math.round(Math.min(99, before + (100 - before) * (done / total)));
}

export function pointsForStep(completed, elapsedSec, budgetMin) {
  if (!completed) return 4;
  const budget = Math.max(30, budgetMin * 60);
  return elapsedSec <= budget * 1.15 ? 15 : 10;
}

export function finishBonus(done, total, elapsedSec, totalMinutes) {
  if (done <= 0) return 0;
  let bonus = done === total ? 20 : 0;
  if (elapsedSec > 0 && elapsedSec <= totalMinutes * 60) bonus += 10;
  return bonus;
}

export function closingLine(done, total, onTime) {
  if (done <= 0) return "Você olhou para a bagunça. Isso já é um começo.";
  if (done < total) return `Você fez ${done} de ${total}. O que ficou pode esperar.`;
  if (onTime) return "Você terminou no tempo. Que orgulho desse reset.";
  return "Você ficou até o fim. O quarto agradece, e você também.";
}

export function greeting(date) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 18) return "BOA NOITE";
  if (hour < 12) return "BOM DIA";
  return "BOA TARDE";
}

export function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function finishClock(date, minutes) {
  return formatClock(new Date(date.getTime() + minutes * 60000));
}

export function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function lastLabel(history, now) {
  if (!history?.real || !history.lastDay) return "Ainda sem um reset salvo";
  const today = localDay(now);
  const start = new Date(`${history.lastDay}T00:00:00`);
  const end = new Date(`${today}T00:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (days <= 0) return "Última organização hoje";
  if (days === 1) return "Última organização ontem";
  return `Última organização há ${days} dias`;
}

/**
 * @param {History | null | undefined} history
 * @param {{ minutes: number, score: number, now: Date }} input
 * @returns {History}
 */
export function recordReset(history, { minutes, score, now }) {
  const day = localDay(now);
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  let streak = 1;
  if (history?.real) {
    if (history.lastDay === day) streak = history.streak;
    else if (history.lastDay === yesterday) streak = history.streak + 1;
  }
  return {
    real: true,
    streak,
    minutes: (history?.real ? history.minutes : 0) + Math.max(1, minutes),
    resets: (history?.real ? history.resets : 0) + 1,
    score,
    lastDay: day,
  };
}
