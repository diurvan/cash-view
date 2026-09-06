"use client";

import { useEffect, useState } from "react";
import { CURRENCIES, formatMoney } from "@/lib/money";
import {
  FORMATOS_FECHA,
  type AppSettings,
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
} from "@/lib/settings";

const selectCls =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function AppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // se quedan los valores por defecto
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaved(false);
    try {
      await saveSettings(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      // sin persistencia disponible
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Ajustes</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Moneda y formato. Se guardan en tu archivo .cvw y se aplican también en el dashboard.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Moneda</span>
          <select
            value={settings.moneda}
            onChange={(e) => void apply({ moneda: e.target.value })}
            className={selectCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Formato de fecha</span>
          <select
            value={settings.formatoFecha}
            onChange={(e) => void apply({ formatoFecha: e.target.value as AppSettings["formatoFecha"] })}
            className={selectCls}
          >
            {FORMATOS_FECHA.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loaded && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Ejemplo: {formatMoney(1250.5, settings.moneda)} <span className="mx-1">·</span> Coma decimal;
          puedes escribir <span className="tabular-nums">1250</span>, <span className="tabular-nums">1250,50</span> o{" "}
          <span className="tabular-nums">1.250,50</span>
          {saved && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Guardado ✓</span>}
        </p>
      )}
    </section>
  );
}