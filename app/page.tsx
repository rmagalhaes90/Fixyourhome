"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Check, ChevronRight, Clock3, Home, ImagePlus, ListChecks, Pause, Play, Sparkles, Trophy, X } from "lucide-react";
import { InstallCard } from "./pwa";
import { authErrorMessage, firstName, initials } from "./lib/ai-plan.mjs";
import { analyzePhoto, shrinkPhoto } from "./lib/photo";
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

type Screen = "home" | "setup" | "analyzing" | "plan" | "cleaning" | "done" | "account";
type Account = {
  id: string;
  email: string;
  name: string;
  provider: string;
  streak: number;
  minutes: number;
  resets: number;
  analyses: number;
  lastScore: number | null;
  lastDay: string | null;
};
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

type NativeBridge = Window & {
  TidyNextNative?: boolean;
  ReactNativeWebView?: { postMessage: (message: string) => void };
  TidyNextPhoto?: (dataUrl: string) => void;
};

function subscribeNative() {
  return () => {};
}

function nativeSnapshot() {
  return "TidyNextNative" in window;
}
const READS = ["A IA está olhando a sua foto", "Medindo a luz e o quanto o quadro está cheio", "Escolhendo poucos passos", "Calculando o tempo"];
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
  const [account, setAccount] = useState<Account | null>(null);
  const [serverReady, setServerReady] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [planSource, setPlanSource] = useState<"ai" | "device">("device");
  const savedHistory = useSyncExternalStore(subscribeHistory, readHistorySnapshot, () => "");
  const history = parseHistory(savedHistory);
  const file = useRef<HTMLInputElement>(null);
  const afterFile = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<(value: string) => void>(() => {});
  const nativeApp = useSyncExternalStore(subscribeNative, nativeSnapshot, () => false);
  const tasks = plan?.tasks ?? [];
  const current = tasks[task];

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("auth_error");
      if (code) {
        setAuthError(authErrorMessage(code));
        setScreen("account");
        window.history.replaceState({}, "", "/");
      }
      if ("TidyNextNative" in window) return;
      void fetch("/api/auth/session")
        .then((response) => {
          if (!response.ok) throw new Error("offline");
          return response.json() as Promise<{ account?: Account | null }>;
        })
        .then((body) => {
          setServerReady(true);
          setAccount(body.account ?? null);
        })
        .catch(() => {
          setServerReady(false);
          setAccount(null);
        });
    });
    return () => cancelAnimationFrame(frame);
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
  const signedIn = Boolean(account);
  const score = signedIn ? account?.lastScore ?? 0 : history.real ? history.score : SAMPLE.score;
  const roomLine = signedIn
    ? account?.lastDay && now
      ? lastLabel({ real: true, streak: account.streak, minutes: account.minutes, resets: account.resets, score: account.lastScore ?? 0, lastDay: account.lastDay }, now)
      : "Ainda sem um reset salvo"
    : history.real && now
      ? lastLabel(history, now)
      : "Última organização há 5 dias";
  const streak = signedIn ? account?.streak ?? 0 : history.streak;
  const organizedMinutes = signedIn ? account?.minutes ?? 0 : history.minutes;
  const resetCount = signedIn ? account?.resets ?? 0 : history.resets;
  const statsLabel = signedIn ? "Sua conta" : history.real ? "Seus resets" : "Exemplo";
  const greetName = account ? firstName(account.name).toLocaleUpperCase("pt-BR") : null;

  useEffect(() => {
    const bridge = window as NativeBridge;
    bridge.TidyNextPhoto = (dataUrl) => pickTarget.current(dataUrl);
    return () => {
      delete bridge.TidyNextPhoto;
    };
  }, []);

  function read(fileValue: File | undefined, set: (value: string) => void) {
    if (!fileValue) return;
    const reader = new FileReader();
    reader.onload = () => set(String(reader.result));
    reader.readAsDataURL(fileValue);
  }

  function choosePhoto(set: (value: string) => void, input: { current: HTMLInputElement | null }) {
    const bridge = window as NativeBridge;
    if (bridge.TidyNextNative && bridge.ReactNativeWebView) {
      pickTarget.current = set;
      bridge.ReactNativeWebView.postMessage(JSON.stringify({ type: "photo" }));
      return;
    }
    input.current?.click();
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

  async function refreshAccount() {
    const response = await fetch("/api/auth/session");
    const body = (await response.json()) as { account?: Account | null };
    setAccount(body.account ?? null);
  }

  async function createPlan() {
    if (!photo) return;
    if (serverReady && !account) {
      setAuthError(authErrorMessage("sign_in_required"));
      setScreen("account");
      return;
    }
    setScreen("analyzing");
    setReadStep(0);
    const started = Date.now();
    let next = buildPlan(FALLBACK, mode);
    let source: "ai" | "device" = "device";
    if (nativeApp) {
      try {
        next = await analyzePhoto(photo, mode);
      } catch {
        next = buildPlan(FALLBACK, mode);
      }
    } else try {
      const image = await shrinkPhoto(photo);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, mode }),
      });
      if (response.status === 401) {
        setAccount(null);
        setAuthError(authErrorMessage("sign_in_required"));
        setScreen("account");
        return;
      }
      if (response.ok) {
        const body = (await response.json()) as { plan: Plan };
        next = body.plan;
        source = "ai";
      } else {
        next = await analyzePhoto(photo, mode);
        await fetch("/api/analyses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, plan: next }),
        });
      }
    } catch {
      try {
        next = await analyzePhoto(photo, mode);
      } catch {
        next = buildPlan(FALLBACK, mode);
      }
    }
    const wait = Math.max(0, 900 - (Date.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait));
    setPlan(next);
    setPlanSource(source);
    if (!nativeApp) void refreshAccount().catch(() => {});
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
    const minutes = Math.max(1, Math.round(seconds / 60));
    writeHistory(recordReset(history, { minutes, score: finalScore, now: moment }));
    if (account) {
      const day = `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, "0")}-${String(moment.getDate()).padStart(2, "0")}`;
      void fetch("/api/resets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, minutes, score: finalScore, day }),
      }).then(() => refreshAccount());
    }
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
          <button className="avatar" onClick={() => setScreen("account")}>{account ? initials(account.name) : "•"}</button>
        </header>

        {screen === "home" && (
          <div className="page home">
            <p className="kicker">{greetName ? `${hello}, ${greetName}` : hello}</p>
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
            <div className="section"><h2>Esta semana</h2><span className="quiet">{statsLabel}</span></div>
            <div className="stats">
              <article>🔥<b>{streak}</b><small>{streak === 1 ? "dia seguido" : "dias seguidos"}</small></article>
              <article><Clock3 /><b>{organizedMinutes} min</b><small>organizando</small></article>
              <article>✦<b>{resetCount}</b><small>{resetCount === 1 ? "reset feito" : "resets feitos"}</small></article>
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
            <button className={"photo " + (photo ? "ready" : "")} onClick={() => choosePhoto(setPhoto, file)} style={photo ? { backgroundImage: `linear-gradient(transparent,#071b1999),url(${photo})` } : undefined}>
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
            <p className="privacy">{nativeApp ? "A foto fica só neste iPhone. O plano é montado aqui." : "Com a conta, a IA olha a foto para montar o plano. A imagem não fica salva."}</p>
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
            <span className="pill"><Sparkles /> {planSource === "ai" ? "PLANO DA IA" : "PLANO DESTA FOTO"}</span>
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
              <button onClick={() => choosePhoto(setAfter, afterFile)} style={after ? { backgroundImage: `url(${after})` } : undefined}>
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

        {screen === "account" && (
          <div className="page account">
            <button className="close" onClick={() => setScreen("home")}><X /></button>
            <div className="center">
              <span className="kicker">CONTA</span>
              <h1>{account ? `Olá, ${firstName(account.name)}.` : nativeApp ? "O plano fica neste iPhone." : "Entre para guardar o seu plano."}</h1>
              <p>{account ? "A conta guarda o nome, o e-mail e os planos. A foto não fica salva." : nativeApp ? "Não há endereço público. Os pontos e o histórico ficam neste aparelho." : "Google ou Apple. A conta é criada no primeiro acesso."}</p>
            </div>
            {authError && <p className="authError">{authError}</p>}
            {account ? (
              <div className="accountCard">
                <b>{account.name}</b>
                <small>{account.email}</small>
                <small>{account.provider === "apple" ? "Apple" : "Google"} · {account.analyses} análises · {account.resets} {account.resets === 1 ? "reset" : "resets"}</small>
                <button className="primary" onClick={() => { void fetch("/api/auth/signout", { method: "POST" }).then(() => setAccount(null)); }}>Sair</button>
              </div>
            ) : nativeApp ? null : (
              <div className="authButtons">
                <a className="auth google" href="/api/auth/google">Continuar com o Google</a>
                <a className="auth apple" href="/api/auth/apple">Continuar com a Apple</a>
              </div>
            )}
          </div>
        )}

        {screen === "home" && (
          <nav>
            <button className="on"><Home />Início</button>
            <button>▦<span>Cômodos</span></button>
            <button className="camera" onClick={() => setScreen("setup")}><Camera /></button>
            <button><ListChecks />Histórico</button>
            <button onClick={() => setScreen("account")}>○<span>Perfil</span></button>
          </nav>
        )}
      </section>
    </main>
  );
}
