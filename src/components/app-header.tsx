"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { getFileName, isLinkedToFile } from "@/lib/local-db";

export function AppHeader() {
  const [name, setName] = useState("CashView.cvw");
  const [linked, setLinked] = useState(false);

  const reload = useCallback(async () => {
    try {
      setName(await getFileName());
      setLinked(await isLinkedToFile());
    } catch {
      // sin almacenamiento local aún
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        // sin almacenamiento local aún
      }
      if (cancelled) return;
    })();
    const onChange = () => void reload();
    window.addEventListener("cvw-file-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("cvw-file-changed", onChange);
    };
  }, [reload]);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link href="/dashboard">
          <Logo size={26} />
        </Link>

        <div className="flex items-center gap-2">
          <div
            title={linked ? "Archivo real en tu disco (autoguardado)" : "Copia guardada en este navegador"}
            className="hidden min-w-0 items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800 sm:flex"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                linked ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span className="max-w-40 truncate text-xs text-zinc-600 dark:text-zinc-300">{name}</span>
          </div>

          <Link
            href="/catalog"
            title="Archivo y catálogo"
            aria-label="Archivo y catálogo"
            className="flex h-9 items-center rounded-xl border border-zinc-200 px-3 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}