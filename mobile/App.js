import { Component, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
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
} from "../app/lib/plan.mjs";
import { signalsFromJpegBase64 } from "./pixels.mjs";

const HISTORY_KEY = "tidynext-history-v1";
const SAMPLE = { real: false, streak: 4, minutes: 54, resets: 3, score: 86 };
const FALLBACK = { brightness: 0.62, clutter: 0.58, colorfulness: 0.5, warm: 0.45, floorClutter: 0.34 };
const READS = ["A IA está olhando a sua foto", "Medindo a luz e o quanto o quadro está cheio", "Escolhendo poucos passos", "Calculando o tempo"];

function storage() {
  try {
    return require("@react-native-async-storage/async-storage").default;
  } catch {
    return null;
  }
}

async function loadHistory() {
  const store = storage();
  if (!store) return SAMPLE;
  try {
    const raw = await store.getItem(HISTORY_KEY);
    return raw ? { ...SAMPLE, ...JSON.parse(raw), real: true } : SAMPLE;
  } catch {
    return SAMPLE;
  }
}

async function saveHistory(next) {
  const store = storage();
  if (!store) return;
  try {
    await store.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // The reset still finishes on this phone when storage is unavailable.
  }
}

async function jpegBase64(uri) {
  const manipulator = require("expo-image-manipulator");
  const format = manipulator.SaveFormat?.JPEG ?? "jpeg";
  if (manipulator.manipulateAsync) {
    const saved = await manipulator.manipulateAsync(uri, [{ resize: { width: 48, height: 48 } }], {
      compress: 0.8,
      format,
      base64: true,
    });
    if (saved.base64) return saved.base64;
  }
  const context = manipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: 48, height: 48 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format, base64: true });
  if (!saved.base64) throw new Error("foto sem dados");
  return saved.base64;
}

function choosePhoto() {
  return new Promise((resolve) => {
    Alert.alert("Foto do cômodo", "A foto fica neste iPhone.", [
      { text: "Câmera", onPress: () => resolve("camera") },
      { text: "Biblioteca", onPress: () => resolve("library") },
      { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

class Guard extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.boot}>
        <Text style={styles.brandText}>TidyNext</Text>
        <Text style={styles.copy}>O app abriu, mas uma tela falhou. Feche e abra de novo.</Text>
        <Text style={styles.muted}>{String(this.state.error.message || this.state.error)}</Text>
      </View>
    );
  }
}

export default function App() {
  return (
    <Guard>
      <StatusBar style="dark" />
      <Phone />
    </Guard>
  );
}

function Phone() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("normal");
  const [photo, setPhoto] = useState(null);
  const [after, setAfter] = useState(null);
  const [plan, setPlan] = useState(null);
  const [task, setTask] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [stepStart, setStepStart] = useState(0);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [note, setNote] = useState("");
  const [readStep, setReadStep] = useState(0);
  const [now, setNow] = useState(new Date());
  const [history, setHistory] = useState(SAMPLE);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    loadHistory().then((value) => {
      if (alive) setHistory(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (screen !== "analyzing") return undefined;
    const id = setInterval(() => setReadStep((value) => (value + 1) % READS.length), 700);
    return () => clearInterval(id);
  }, [screen]);

  const clock = formatClock(now);
  const hello = greeting(now);
  const tasks = plan?.tasks ?? [];
  const current = tasks[task];
  const score = history.real ? history.score : SAMPLE.score;
  const roomLine = history.real ? lastLabel(history, now) : "Última organização há 5 dias";
  const statsLabel = history.real ? "Seus resets" : "Exemplo";

  function reset() {
    setScreen("home");
    setPhoto(null);
    setAfter(null);
    setPlan(null);
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setRunning(false);
    setDoneCount(0);
    setPoints(0);
    setNote("");
  }

  async function pick(target) {
    const kind = await choosePhoto();
    if (!kind) return;
    try {
      const picker = require("expo-image-picker");
      const permission = kind === "camera"
        ? await picker.requestCameraPermissionsAsync()
        : await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permissão", "O TidyNext precisa da câmera ou das fotos neste iPhone.");
        return;
      }
      const result = kind === "camera"
        ? await picker.launchCameraAsync({ quality: 0.6, exif: false })
        : await picker.launchImageLibraryAsync({ quality: 0.6, exif: false });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      target(result.assets[0].uri);
    } catch (error) {
      Alert.alert("Foto", error instanceof Error ? error.message : "Não foi possível abrir a foto.");
    }
  }

  async function createPlan() {
    if (!photo) return;
    setScreen("analyzing");
    setReadStep(0);
    const started = Date.now();
    let signals = FALLBACK;
    try {
      signals = signalsFromJpegBase64(await jpegBase64(photo));
    } catch {
      signals = FALLBACK;
    }
    const next = buildPlan(signals, mode);
    const wait = Math.max(0, 900 - (Date.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait));
    setPlan(next);
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setDoneCount(0);
    setPoints(0);
    setNote("");
    setRunning(false);
    setScreen("plan");
  }

  function startCleaning() {
    setTask(0);
    setSeconds(0);
    setStepStart(0);
    setDoneCount(0);
    setPoints(0);
    setNote("");
    setRunning(true);
    setScreen("cleaning");
  }

  function advance(completed) {
    if (!current || !plan) return;
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
    const saved = recordReset(history.real ? history : null, { minutes, score: finalScore, now });
    setHistory(saved);
    void saveHistory(saved);
    setScreen("done");
  }

  const onTime = plan ? seconds <= plan.totalMinutes * 60 : false;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={reset}><Text style={styles.brandText}>TidyNext</Text></Pressable>
        <Text style={styles.clock}>{clock}</Text>
        <Pressable onPress={() => setScreen("account")}><Text style={styles.clock}>•</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        {screen === "home" && (
          <View>
            <Text style={styles.kicker}>{hello}</Text>
            <Text style={styles.title}>Qual bagunça vamos resolver agora?</Text>
            <Text style={styles.copy}>Agora são {clock}. Uma foto vira um plano curto.</Text>
            <Pressable style={styles.scan} onPress={() => setScreen("setup")}>
              <Text style={styles.scanTitle}>Escanear uma bagunça</Text>
              <Text style={styles.scanText}>A foto vira a sua lista em segundos</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => { setMode("quick"); setScreen("setup"); }}>
              <Text style={styles.scanTitleDark}>Não sei por onde começar</Text>
              <Text style={styles.muted}>Mostre o ambiente. Pense só no próximo passo.</Text>
            </Pressable>
            <Text style={styles.section}>{statsLabel}</Text>
            <View style={styles.stats}>
              <Stat value={String(history.streak)} label={history.streak === 1 ? "dia seguido" : "dias seguidos"} />
              <Stat value={`${history.minutes} min`} label="organizando" />
              <Stat value={String(history.resets)} label={history.resets === 1 ? "reset feito" : "resets feitos"} />
            </View>
            <Text style={styles.muted}>{roomLine} · score {score}</Text>
          </View>
        )}

        {screen === "setup" && (
          <View>
            <Text style={styles.kicker}>NOVO RESET · {clock}</Text>
            <Text style={styles.title}>Mostre a bagunça. Nós cuidamos do plano.</Text>
            <Pressable style={styles.photoButton} onPress={() => { void pick(setPhoto); }}>
              {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <Text style={styles.scanTitleDark}>Tirar ou escolher foto</Text>}
            </Pressable>
            <Text style={styles.section}>Quanto tempo você tem?</Text>
            <View style={styles.modes}>
              {["quick", "normal", "deep"].map((key) => (
                <Pressable key={key} style={[styles.mode, mode === key && styles.modeOn]} onPress={() => setMode(key)}>
                  <Text style={styles.modeTitle}>{key === "quick" ? "Rápido" : key === "normal" ? "Normal" : "Profundo"}</Text>
                  <Text style={styles.muted}>{MODES[key].hint}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.primary, !photo && styles.disabled]} disabled={!photo} onPress={() => { void createPlan(); }}>
              <Text style={styles.primaryText}>Criar meu plano</Text>
            </Pressable>
            <Text style={styles.muted}>A foto fica só neste iPhone. O plano é montado aqui.</Text>
          </View>
        )}

        {screen === "analyzing" && (
          <View>
            {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
            <Text style={styles.kicker}>LENDO A FOTO · {clock}</Text>
            <Text style={styles.title}>Transformando a imagem em passos simples…</Text>
            <Text style={styles.copy}>{READS[readStep]}</Text>
          </View>
        )}

        {screen === "plan" && plan && (
          <View>
            <Text style={styles.kicker}>PLANO DESTA FOTO</Text>
            <Text style={styles.title}>{plan.insightTitle}</Text>
            <Text style={styles.copy}>{plan.insightBody}</Text>
            <Text style={styles.copy}>Se começar agora ({clock}), termina por volta de {finishClock(now, plan.totalMinutes)}.</Text>
            <Text style={styles.section}>{tasks.length} passos · {plan.totalMinutes} min</Text>
            {plan.notes.map((item) => <Text key={item} style={styles.note}>{item}</Text>)}
            {tasks.map((item, index) => (
              <Text key={item.id} style={styles.taskLine}>{item.icon} {index + 1}. {item.title} · {item.minutes} min</Text>
            ))}
            <Pressable style={styles.primary} onPress={startCleaning}>
              <Text style={styles.primaryText}>Começar agora</Text>
            </Pressable>
          </View>
        )}

        {screen === "cleaning" && current && (
          <View>
            <Text style={styles.kicker}>{task + 1} DE {tasks.length} · {formatDuration(seconds)}</Text>
            <Text style={styles.emoji}>{current.icon}</Text>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.copy}>{current.detail}</Text>
            <Text style={styles.muted}>Cerca de {current.minutes} min · agora são {clock}</Text>
            {note ? <Text style={styles.affirm}>{note}</Text> : null}
            <Pressable style={styles.secondary} onPress={() => setRunning((value) => !value)}>
              <Text style={styles.scanTitleDark}>{running ? "Pausar" : "Continuar"}</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => advance(true)}>
              <Text style={styles.primaryText}>Feito · +15 pontos</Text>
            </Pressable>
            <Pressable onPress={() => advance(false)}><Text style={styles.link}>Pular por agora</Text></Pressable>
          </View>
        )}

        {screen === "done" && plan && (
          <View>
            <Text style={styles.kicker}>RESET CONCLUÍDO · {clock}</Text>
            <Text style={styles.title}>Olha o que você acabou de fazer.</Text>
            <Text style={styles.copy}>{closingLine(doneCount, tasks.length, onTime)}</Text>
            <Text style={styles.reward}>{points} pontos</Text>
            <Text style={styles.copy}>{doneCount} passos em {formatDuration(seconds)} · agora são {clock}</Text>
            <Pressable style={styles.photoButton} onPress={() => { void pick(setAfter); }}>
              {after ? <Image source={{ uri: after }} style={styles.photo} /> : <Text style={styles.scanTitleDark}>Adicionar foto do resultado</Text>}
            </Pressable>
            <Text style={styles.section}>Room score {plan.beforeScore} → {afterScore(plan.beforeScore, doneCount, tasks.length)}</Text>
            <Pressable style={styles.primary} onPress={reset}><Text style={styles.primaryText}>Voltar ao início</Text></Pressable>
          </View>
        )}

        {screen === "account" && (
          <View>
            <Text style={styles.title}>O plano fica neste iPhone.</Text>
            <Text style={styles.copy}>Não há endereço público. Os pontos e o histórico ficam neste aparelho.</Text>
            <Pressable style={styles.primary} onPress={() => setScreen("home")}><Text style={styles.primaryText}>Voltar</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7f4", paddingTop: 58 },
  header: { paddingHorizontal: 22, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandText: { color: "#0c7b67", fontSize: 22, fontWeight: "800" },
  clock: { color: "#10322d", fontSize: 16, fontWeight: "700" },
  page: { padding: 22, paddingBottom: 48 },
  kicker: { color: "#0c7b67", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#10322d", fontSize: 30, fontWeight: "800", marginTop: 8, marginBottom: 8 },
  copy: { color: "#3d524c", fontSize: 16, lineHeight: 22, marginBottom: 12 },
  muted: { color: "#71817d", fontSize: 13, marginTop: 4 },
  scan: { backgroundColor: "#10322d", borderRadius: 22, padding: 18, marginTop: 12 },
  scanTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  scanText: { color: "#d5e6e0", marginTop: 4 },
  scanTitleDark: { color: "#10322d", fontSize: 16, fontWeight: "800" },
  secondary: { borderWidth: 1, borderColor: "#dce7e3", backgroundColor: "#ffffff", borderRadius: 18, padding: 14, marginTop: 12 },
  section: { marginTop: 22, marginBottom: 8, color: "#10322d", fontWeight: "800" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: "#ffffff", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#dce7e3" },
  statValue: { color: "#10322d", fontSize: 18, fontWeight: "800" },
  photoButton: { height: 180, borderRadius: 22, backgroundColor: "#e5f1ec", borderWidth: 2, borderColor: "#98c2b7", alignItems: "center", justifyContent: "center", overflow: "hidden", marginVertical: 12 },
  photo: { width: "100%", height: "100%" },
  modes: { flexDirection: "row", gap: 8 },
  mode: { flex: 1, backgroundColor: "#ffffff", borderRadius: 16, padding: 10, borderWidth: 1, borderColor: "#dce7e3" },
  modeOn: { borderColor: "#0c7b67", borderWidth: 2, backgroundColor: "#eef8f4" },
  modeTitle: { fontWeight: "800", color: "#10322d" },
  primary: { backgroundColor: "#0c7b67", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 16 },
  disabled: { backgroundColor: "#b4c8c2" },
  primaryText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  taskLine: { color: "#10322d", fontSize: 16, marginBottom: 8 },
  note: { color: "#0c7b67", fontWeight: "700", marginRight: 8 },
  emoji: { fontSize: 64, marginVertical: 12 },
  affirm: { backgroundColor: "#f3f8d8", borderRadius: 14, padding: 12, color: "#10322d", fontWeight: "700", marginVertical: 8 },
  reward: { alignSelf: "flex-start", backgroundColor: "#e0f46f", color: "#10322d", fontWeight: "800", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  link: { color: "#0c7b67", fontWeight: "800", textAlign: "center", marginTop: 14 },
  boot: { flex: 1, backgroundColor: "#f4f7f4", alignItems: "center", justifyContent: "center", padding: 24 },
});
