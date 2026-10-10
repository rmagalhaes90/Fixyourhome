"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Phone = "ios" | "android" | "desktop" | "installed";

function phoneKind(): Phone {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useInstall() {
  const [phone, setPhone] = useState<Phone | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhone(phoneKind()));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPhone("installed");
    setPrompt(null);
  }

  return { phone, canInstall: Boolean(prompt), install };
}

export function InstallCard() {
  const { phone, canInstall, install } = useInstall();
  if (!phone || phone === "installed") return null;

  const detail =
    phone === "ios"
      ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
      : phone === "android"
        ? "No Chrome, toque em Instalar para colocar o TidyNext na tela inicial."
        : "Abra este site no Safari ou no Chrome do celular para instalar.";

  return (
    <aside className="install">
      <span>
        <b>Instalar no celular</b>
        <small>{detail}</small>
      </span>
      {canInstall && <button type="button" onClick={install}>Instalar</button>}
    </aside>
  );
}
