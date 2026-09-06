"use client";

import { useEffect } from "react";

// Registra el service worker (solo en producción) con la política del navegador:
// una vez registrado, para actualizarlo hay que esperar un nuevo "load".
export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // si el registro falla (HTTP, soporte), la app funciona igual
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}