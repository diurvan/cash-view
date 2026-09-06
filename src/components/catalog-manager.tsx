"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoriaRow, CuentaRow } from "@/lib/catalog";

type UiCategoria = {
  tipo: string;
  categoria: string;
  subcategoria?: string;
  presupuesto: string;
};

type UiCuenta = {
  nombre: string;
  tipo: string;
  saldo: string;
};

const inputCls =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function serialize(cats: UiCategoria[], accs: UiCuenta[]): string {
  return JSON.stringify([cats, accs]);
}

export function CatalogManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [foundCategorias, setFoundCategorias] = useState(true);
  const [foundCuentas, setFoundCuentas] = useState(true);
  const [categorias, setCategorias] = useState<UiCategoria[]>([]);
  const [cuentas, setCuentas] = useState<UiCuenta[]>([]);
  const [lastSaved, setLastSaved] = useState("");

  const dirty = useMemo(() => serialize(categorias, cuentas) !== lastSaved, [categorias, cuentas, lastSaved]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/catalog");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "No se pudo leer el catálogo.");
        }
        const d = await res.json();
        if (cancelled) return;
        const cats: UiCategoria[] = (d.categorias ?? []).map((c: CategoriaRow) => ({
          tipo: c.tipo || "Gasto",
          categoria: c.categoria,
          subcategoria: c.subcategoria,
          presupuesto:
            c.presupuesto != null && c.presupuesto !== 0 ? String(c.presupuesto) : "",
        }));
        const accs: UiCuenta[] = (d.cuentas ?? []).map((c: CuentaRow) => ({
          nombre: c.nombre,
          tipo: c.tipo ?? "",
          saldo: c.saldo ?? "",
        }));
        setCategorias(cats);
        setCuentas(accs);
        setFoundCategorias(d.foundCategorias ?? true);
        setFoundCuentas(d.foundCuentas ?? true);
        setError(null);
        setLastSaved(serialize(cats, accs));
        setSaved(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudo leer el catálogo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-400">Cargando catálogo…</p>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Categorías</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Se guardan en tu hoja y se usan al registrar movimientos.
                </p>
              </div>
            </div>

            {!foundCategorias ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                No se encontró una pestaña <span className="font-medium">“Categorías”</span> en tu hoja.
                Usa la plantilla de CashView para gestionar el catálogo.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {categorias.map((c, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr_110px_36px] sm:items-center"
                    >
                      <select
                        value={c.tipo}
                        onChange={(e) =>
                          setCategorias(categorias.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))
                        }
                        className={inputCls}
                      >
                        <option>Gasto</option>
                        <option>Ingreso</option>
                      </select>
                      <input
                        type="text"
                        value={c.categoria}
                        placeholder="Nombre de categoría"
                        onChange={(e) =>
                          setCategorias(categorias.map((x, j) => (j === i ? { ...x, categoria: e.target.value } : x)))
                        }
                        className={inputCls}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={c.presupuesto}
                        placeholder="Presupuesto"
                        onChange={(e) =>
                          setCategorias(categorias.map((x, j) => (j === i ? { ...x, presupuesto: e.target.value } : x)))
                        }
                        className={`${inputCls} tabular-nums`}
                      />
                      <button
                        onClick={() => setCategorias(categorias.filter((_, j) => j !== i))}
                        aria-label="Quitar categoría"
                        className="flex h-10 w-full items-center justify-center rounded-xl text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                  {categorias.length === 0 && (
                    <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-400 dark:bg-zinc-900">
                      Aún no tienes categorías. Agrega una abajo.
                    </p>
                  )}
                </ul>
                <button
                  onClick={() =>
                    setCategorias([...categorias, { tipo: "Gasto", categoria: "", presupuesto: "" }])
                  }
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 text-xs font-medium text-zinc-500 transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Agregar categoría
                </button>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Cuentas</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Medios de pago disponibles al registrar movimientos.
              </p>
            </div>

            {!foundCuentas ? (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                No se encontró una pestaña <span className="font-medium">“Cuentas”</span> en tu hoja. Usa la
                plantilla de CashView para gestionar el catálogo.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cuentas.map((c, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_110px_36px] sm:items-center"
                    >
                      <input
                        type="text"
                        value={c.nombre}
                        placeholder="Nombre (ej: Yape)"
                        onChange={(e) =>
                          setCuentas(cuentas.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
                        }
                        className={inputCls}
                      />
                      <input
                        type="text"
                        value={c.tipo}
                        placeholder="Tipo (ej: Billetera digital)"
                        onChange={(e) =>
                          setCuentas(cuentas.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))
                        }
                        className={inputCls}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={c.saldo}
                        placeholder="Saldo inicial"
                        onChange={(e) =>
                          setCuentas(cuentas.map((x, j) => (j === i ? { ...x, saldo: e.target.value } : x)))
                        }
                        className={`${inputCls} tabular-nums`}
                      />
                      <button
                        onClick={() => setCuentas(cuentas.filter((_, j) => j !== i))}
                        aria-label="Quitar cuenta"
                        className="flex h-10 w-full items-center justify-center rounded-xl text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                  {cuentas.length === 0 && (
                    <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-400 dark:bg-zinc-900">
                      Aún no tienes cuentas. Agrega una abajo.
                    </p>
                  )}
                </ul>
                <button
                  onClick={() => setCuentas([...cuentas, { nombre: "", tipo: "", saldo: "" }])}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 text-xs font-medium text-zinc-500 transition hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Agregar cuenta
                </button>
              </>
            )}
          </section>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Se escribe directo en tu hoja de cálculo.
            </p>
            <button
              onClick={save}
              disabled={!dirty || saving || (!foundCategorias && !foundCuentas)}
              className={`inline-flex h-10 min-w-32 items-center justify-center rounded-xl px-5 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-50 ${
                saved ? "bg-zinc-500" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (foundCategorias) {
        payload.categorias = categorias.map((c) => ({
          tipo: c.tipo === "Ingreso" ? "Ingreso" : "Gasto",
          categoria: c.categoria,
          subcategoria: c.subcategoria,
          presupuesto: c.presupuesto,
        }));
      }
      if (foundCuentas) {
        payload.cuentas = cuentas.map((c) => ({
          nombre: c.nombre,
          tipo: c.tipo,
          saldo: c.saldo,
        }));
      }
      const res = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "No se pudieron guardar los cambios.");
      }
      await res.json();
      setLastSaved(serialize(categorias, cuentas));
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }
}