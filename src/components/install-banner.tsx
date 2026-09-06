"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// Evento que Chrome lanza cuando la app cumple los requisitos PWA y puede
// instalarse. Al hacer preventDefault(), se oculta la barra nativa y decimos
// nosotros: en lugar del aviso del navegador mostramos nuestro banner.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY = "cashview-install-banner";

function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallBanner() {
  const [prompter, setPrompter] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    let mounted = true;
    const media = window.matchMedia("(display-mode: standalone)");

    const init = window.setTimeout(() => {
      if (!mounted) return;
      try {
        setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
      } catch {
        setDismissed(false);
      }
      if (media.matches) {
        setInstalled(true);
      } else if (isIOS()) {
        setIos(true);
      }
    }, 0);

    const onChange = () => {
      if (media.matches) setInstalled(true);
    };
    media.addEventListener("change", onChange);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!mounted) return;
      setPrompter(e as BeforeInstallPromptEvent);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // sin acceso a sessionStorage
      }
      setDismissed(false);
    };
    const onInstalled = () => {
      if (!mounted) return;
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      mounted = false;
      window.clearTimeout(init);
      media.removeEventListener("change", onChange);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || (!prompter && !ios)) return null;

  const doInstall = () => {
    if (!prompter) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // sin acceso a sessionStorage
    }
    void prompter.prompt().then(() => prompter.userChoice);
    setPrompter(null);
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // sin acceso a sessionStorage
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Instala cashview</p>
          {ios && !prompter ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              En iPhone/iPad: Safari → Compartir → <span className="font-medium">Añadir a pantalla de inicio</span>
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Agrégala a tu pantalla de inicio y úsala como una app.
            </p>
          )}
        </div>
        {prompter && (
          <button
            onClick={doInstall}
            className="inline-flex h-9 shrink-0 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Cerrar aviso de instalación"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}