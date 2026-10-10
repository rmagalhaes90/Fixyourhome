"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Check, ChevronRight, Clock3, Home, ImagePlus, ListChecks, Pause, Play, Sparkles, Trophy, X } from "lucide-react";
import { InstallCard } from "./pwa";
import { analyzePhoto } from "./lib/photo";
import {
  AFFIRMATIONS,
  MODES,
  SKIP_NOTE,
  afterScore,
  buildPlan,
  closingLine,
  finishBonus,
  finishClock,
  formatClock,
  formatDuration,
  greeting,
  lastLabel,
  pointsForStep,
  recordReset,
} from "./lib/plan.mjs";

type Screen = "home" | "setup" | "analyzing" | "plan" | "cleaning" | "done";
type Mode = "quick" | "normal" | "deep";
type Plan = ReturnType<typeof buildPlan>;
type History = ReturnType<typeof recordReset>;

const HISTORY_KEY = "tidynext-history-v1";
const SAMPLE: History = { real: false, streak: 4, minutes: 54, resets: 3, score: 86 };
const historyListeners = new Set<() => void>();
let historySnapshot = "";
let historyLoaded = false;

function subscribeHistory(listener: () => void) {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}

function readHistorySnapshot() {
  if (!historyLoaded) {
    historySnapshot = localStorage.getItem(HISTORY_KEY) ?? "";
    historyLoaded = true;
  }
  return historySnapshot;
}

function parseHistory(raw: string): History {
  if (!raw) return SAMPLE;
  try {
    return { ...SAMPLE, ...JSON.parse(raw) };
  } catch {
    return SAMPLE;
  }
}

function writeHistory(next: History) {
  historySnapshot = JSON.stringify(next);
  historyLoaded = true;
  localStorage.setItem(HISTORY_KEY, historySnapshot);
  historyListeners.forEach((listener) => listener());
}
const READS = ["Lendo a sua foto", "Medindo a luz e o quanto o quadro está cheio", "Escolhendo poucos passos", "Calculando o tempo"];
const FALLBACK = { brightness: 0.62, clutter: 0.58, colorfulness: 0.5, warm: 0.45, floorClutter: 0.34 };

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<Mode>("normal");
  const [photo, setPhoto] = useState<string>();
  const [after, setAfter] = useState<string>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [task, setTask] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [stepStart, setStepStart] = useState(0);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [note, setNote] = useState<string>();
  const [readStep, setReadStep] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const savedHistory = useSyncExternalStore(subscribeHistory, readHistorySnapshot, () => "");
  const history = parseHistory(savedHistory);
  const file = useRef<HTMLInputElement>(null);
  const afterFile = useRef<HTMLInputElement>(null);
  const tasks = plan?.tasks ?? [];
  const current = tasks[task];

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (screen !== "analyzing") return;
    const id = setInterval(() => setReadStep((value) => (value + 1) % READS.length), 700);
    return () => clearInterval(id);
  }, [screen]);

  const clock = now ? formatClock(now) : "--:--";
  const hello = now ? greeting(now) : "OLÁ";
  const score = history.real ? history.score : SAMPLE.score;
  const roomLine = history.real && now ? lastLabel(history, now) : "Última organização há 5 dias";

  function read(fileValue: File | undefined, set: (value: string) => void) {
    if (!fileValue) return;
    const reader = new FileReader();
    reader.onload = () => set(String(reader.result));
    reader.readAsDataURL(fileValue);
  }

  function reset() {
    setScreen("home");
    setPhoto(undefined);
    setAfter(undefined);
    setPlan(null);
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setRunning(false);
    setDoneCount(0);
    setPoints(0);
    setNote(undefined);
  }

  async function createPlan() {
    if (!photo) return;
    setScreen("analyzing");
    setReadStep(0);
    const started = Date.now();
    let next = buildPlan(FALLBACK, mode);
    try {
      next = await analyzePhoto(photo, mode);
    } catch {
      next = buildPlan(FALLBACK, mode);
    }
    const wait = Math.max(0, 1600 - (Date.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait));
    setPlan(next);
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setDoneCount(0);
    setPoints(0);
    setNote(undefined);
    setScreen("plan");
  }

  function startCleaning() {
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setDoneCount(0);
    setPoints(0);
    setNote(undefined);
    setRunning(true);
    setScreen("cleaning");
  }

  function advance(completed: boolean) {
    if (!current || !plan) return;
    const moment = now ?? new Date();
    const spent = seconds - stepStart;
    const gained = pointsForStep(completed, spent, current.minutes);
    const nextDone = doneCount + (completed ? 1 : 0);
    const nextPoints = points + gained;
    const last = task === tasks.length - 1;
    setPoints(nextPoints);
    setDoneCount(nextDone);
    setNote(completed ? AFFIRMATIONS[task % AFFIRMATIONS.length] : SKIP_NOTE);
    if (!last) {
      setTask(task + 1);
      setStepStart(seconds);
      return;
    }
    setRunning(false);
    const bonus = finishBonus(nextDone, tasks.length, seconds, plan.totalMinutes);
    const totalPoints = nextPoints + bonus;
    const finalScore = afterScore(plan.beforeScore, nextDone, tasks.length);
    setPoints(totalPoints);
    writeHistory(recordReset(history, { minutes: Math.max(1, Math.round(seconds / 60)), score: finalScore, now: moment }));
    setScreen("done");
  }

  const onTime = plan ? seconds <= plan.totalMinutes * 60 : false;
  const remaining = tasks.slice(task).reduce((sum, item) => sum + item.minutes, 0);

  return (
    <main className="shell">
      <section className="phone">
        <header>
          <button className="brand" onClick={reset}>
            <i><Sparkles /></i>TidyNext
          </button>
          <time className="clockChip"><Clock3 />{clock}</time>
          <button className="avatar">RM</button>
        </header>

        {screen === "home" && (
          <div className="page home">
            <p className="kicker">{hello}, RAMON</p>
            <h1>Qual bagunça vamos<br />resolver agora?</h1>
            <p className="when">Agora são <b>{clock}</b>. Uma foto vira um plano curto.</p>
            <button className="scan" onClick={() => setScreen("setup")}>
              <i><Camera /></i>
              <span><b>Escanear uma bagunça</b><small>A foto vira a sua lista em segundos</small></span>
              <ChevronRight />
            </button>
            <button className="panic" onClick={() => { setMode("quick"); setScreen("setup"); }}>
              <i>😩</i>
              <span><b>Não sei por onde começar</b><small>Mostre o ambiente. Pense só no próximo passo.</small></span>
            </button>
            <InstallCard />
            <div className="section"><h2>Esta semana</h2><span className="quiet">{history.real ? "Seus resets" : "Exemplo"}</span></div>
            <div className="stats">
              <article>🔥<b>{history.streak}</b><small>{history.streak === 1 ? "dia seguido" : "dias seguidos"}</small></article>
              <article><Clock3 /><b>{history.minutes} min</b><small>organizando</small></article>
              <article>✦<b>{history.resets}</b><small>{history.resets === 1 ? "reset feito" : "resets feitos"}</small></article>
            </div>
            <div className="room">
              <i>🛏️</i>
              <span><small>SEU QUARTO</small><b>Está na hora de um reset?</b><em>{roomLine}</em></span>
              <strong>{score}<small>SCORE</small></strong>
            </div>
          </div>
        )}

        {screen === "setup" && (
          <div className="page setup">
            <button className="close" onClick={() => setScreen("home")}><X /></button>
            <div className="center">
              <span className="kicker">NOVO RESET · {clock}</span>
              <h1>Mostre a bagunça.<br />Nós cuidamos do plano.</h1>
              <p>Uma foto ampla e bem iluminada funciona melhor.</p>
            </div>
            <input ref={file} hidden type="file" accept="image/*" capture="environment" onChange={(event) => read(event.target.files?.[0], setPhoto)} />
            <button className={"photo " + (photo ? "ready" : "")} onClick={() => file.current?.click()} style={photo ? { backgroundImage: `linear-gradient(transparent,#071b1999),url(${photo})` } : undefined}>
              {photo ? <><b><Check /> Foto pronta</b><small>Toque para trocar</small></> : <><i><ImagePlus /></i><b>Tirar ou escolher foto</b><small>JPG, PNG ou HEIC</small></>}
            </button>
            <div className="modeTitle"><b>Quanto tempo você tem?</b><small>Você pode mudar depois</small></div>
            <div className="modes">
              {(["quick", "normal", "deep"] as Mode[]).map((key) => (
                <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>
                  <i>{key === "quick" ? "⚡" : key === "normal" ? "✨" : "🫧"}</i>
                  <b>{key === "quick" ? "Rápido" : key === "normal" ? "Normal" : "Profundo"}</b>
                  <small>{MODES[key].hint}</small>
                </button>
              ))}
            </div>
            <button className="primary" disabled={!photo} onClick={createPlan}><Sparkles />Criar meu plano</button>
            <p className="privacy">Sua foto fica neste aparelho e só serve para montar este plano.</p>
          </div>
        )}

        {screen === "analyzing" && (
          <div className="page analyzing">
            <div className="shot" style={photo ? { backgroundImage: `url(${photo})` } : undefined} />
            <div className="radar"><i /><Sparkles /></div>
            <span className="kicker">LENDO A FOTO · {clock}</span>
            <h1>Transformando a imagem<br />em passos simples…</h1>
            <div className="dots">● ● ●</div>
            <p>{READS[readStep]}</p>
          </div>
        )}

        {screen === "plan" && plan && (
          <div className="page plan">
            <button className="close" onClick={() => setScreen("setup")}><X /></button>
            <span className="pill"><Sparkles /> PLANO PRONTO</span>
            <h1>Você consegue resolver isso em cerca de <em>{plan.totalMinutes} minutos.</em></h1>
            {now && <p className="when">Se começar agora ({clock}), termina por volta de <b>{finishClock(now, plan.totalMinutes)}</b>.</p>}
            {photo && <div className="planShot" style={{ backgroundImage: `url(${photo})` }}><b>Sua foto</b></div>}
            <div className="notes">{plan.notes.map((item) => <span key={item}>{item}</span>)}</div>
            <div className="insight">💡 <p><b>{plan.insightTitle}.</b> {plan.insightBody}</p></div>
            <div className="summary">
              <div><ListChecks /><span><b>{plan.tasks.length} passos</b><small>{MODES[mode].title}</small></span></div>
              <div><Clock3 /><span><b>{plan.totalMinutes} min</b><small>tempo estimado</small></span></div>
            </div>
            <div className="preview">
              {plan.tasks.map((item, index) => (
                <div key={item.id}><i>{index + 1}</i><b>{item.title}</b><small>{item.minutes} min</small></div>
              ))}
            </div>
            <button className="primary" onClick={startCleaning}><Play />Começar agora</button>
          </div>
        )}

        {screen === "cleaning" && current && plan && (
          <div className="page cleaning">
            <div className="cleanTop">
              <button onClick={() => { setRunning(false); setScreen("plan"); }}><X /></button>
              <b>AGORA SÃO {clock}</b>
              <button onClick={() => setRunning(!running)}>{running ? <Pause /> : <Play />}{formatDuration(seconds)}</button>
            </div>
            <div className="progress"><i style={{ width: `${(task / tasks.length) * 100}%` }} /></div>
            <div className="timeRow">
              <span>neste passo<b>{formatDuration(seconds - stepStart)}</b></span>
              <span>faltam cerca de<b>{remaining} min</b></span>
              <span>pontos<b>{points}</b></span>
            </div>
            <p className="kicker">PASSO {task + 1} DE {tasks.length}</p>
            <div className="taskIcon">{current.icon}</div>
            <h1>{current.title}</h1>
            <p>{current.detail}</p>
            <span className="estimate"><Clock3 /> Aproximadamente <b>{current.minutes} minutos</b></span>
            {note && <div className="affirm">{note}</div>}
            <button className="complete" onClick={() => advance(true)}><Check />Concluído</button>
            <button className="skip" onClick={() => advance(false)}>Pular por agora</button>
            <small className="encourage">Não pense no quarto inteiro. Faça somente isso agora.</small>
          </div>
        )}

        {screen === "done" && plan && (
          <div className="page done">
            <div className="trophy"><Trophy /></div>
            <span className="kicker">RESET CONCLUÍDO · {clock}</span>
            <h1>Olha o que você<br />acabou de fazer.</h1>
            <p>{closingLine(doneCount, tasks.length, onTime)}</p>
            <div className="reward"><Sparkles /> {points} pontos</div>
            <p className="when">{doneCount} passos feitos em <b>{formatDuration(seconds)}</b>{now ? <> · agora são <b>{clock}</b></> : null}</p>
            <div className="photos">
              <div style={photo ? { backgroundImage: `url(${photo})` } : undefined}><b>ANTES</b></div>
              <input ref={afterFile} hidden type="file" accept="image/*" capture="environment" onChange={(event) => read(event.target.files?.[0], setAfter)} />
              <button onClick={() => afterFile.current?.click()} style={after ? { backgroundImage: `url(${after})` } : undefined}>
                {after ? <b>DEPOIS</b> : <><Camera /><span>Adicionar foto<br />do resultado</span></>}
              </button>
            </div>
            <div className="score">
              <span><small>ROOM SCORE</small><b>{plan.beforeScore} → {afterScore(plan.beforeScore, doneCount, tasks.length)}</b></span>
              <strong>+{afterScore(plan.beforeScore, doneCount, tasks.length) - plan.beforeScore}</strong>
            </div>
            <button className="primary" onClick={reset}><Home />Voltar ao início</button>
          </div>
        )}

        {screen === "home" && (
          <nav>
            <button className="on"><Home />Início</button>
            <button>▦<span>Cômodos</span></button>
            <button className="camera" onClick={() => setScreen("setup")}><Camera /></button>
            <button><ListChecks />Histórico</button>
            <button>○<span>Perfil</span></button>
          </nav>
        )}
      </section>
    </main>
  );
}
