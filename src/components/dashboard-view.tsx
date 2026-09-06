"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { categoriasGasto, categoriasIngreso, estados, metaMedios, subcategoriasGasto, subcategoriasIngreso } from "@/lib/template";
import {
  formatMoney,
  fmtRange,
  lastNDaysRange,
  monthKey,
  monthLabel,
  thisMonthRange,
  thisYearRange,
  todayIso,
} from "@/lib/format";
import { normalizeNumber } from "@/lib/money";

type Record = {
  row: number;
  fecha: string;
  tipo: string;
  categoria: string;
  subcategoria?: string;
  descripcion: string;
  importe: number;
  cuenta?: string;
  estado?: string;
};

const COLOR_INGRESO = "#059669";
const COLOR_GASTO = "#e11d48";
const PALETTE = [
  "#059669",
  "#0d9488",
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#65a30d",
  "#475569",
  "#334155",
];
const TODO_RANGE = { from: "0000-01-01", to: "9999-12-31" };
const inputCls =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

type RangePreset = "mes" | "30d" | "anio" | "todo" | "custom";

export function DashboardView() {
  const router = useRouter();
  const [records, setRecords] = useState<Record[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [range, setRange] = useState<{ preset: RangePreset; from: string; to: string }>(() => ({
    preset: "mes",
    ...thisMonthRange(),
  }));

  const load = useCallback(
    async (from?: string, to?: string) => {
      const q = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";
      const res = await fetch(`/api/sheets/records${q}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        if (d?.error?.includes("Primero elige una hoja")) {
          setRecords([]);
          setError(null);
          return;
        }
        throw new Error(d?.error ?? "Error al leer");
      }
      const d = await res.json();
      setError(null);
      setRecords(d.records);
    },
    [router]
  );

  const refresh = useCallback(() => load(range.from, range.to), [load, range.from, range.to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar los registros.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const applyPreset = (preset: Exclude<RangePreset, "custom">) => {
    const r = preset === "mes" ? thisMonthRange() : preset === "30d" ? lastNDaysRange(30) : preset === "anio" ? thisYearRange() : TODO_RANGE;
    setRange({ preset, ...r });
  };

  const save = useCallback(
    async (input: Record, row?: number) => {
      setBusy(true);
      try {
        const res = await fetch(row ? `/api/sheets/records/${row}` : "/api/sheets/records", {
          method: row ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Error al guardar");
        }
        setError(null);
        setEditing(null);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (row: number) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/sheets/records/${row}`, { method: "DELETE" });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Error al eliminar");
        }
        setError(null);
        setConfirmDelete(null);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const totals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const r of records ?? []) {
      if (r.tipo.toLowerCase().includes("ingreso")) ingresos += r.importe;
      else gastos += r.importe;
    }
    return { ingresos, gastos, saldo: ingresos - gastos };
  }, [records]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records ?? []) {
      if (r.tipo.toLowerCase().includes("gasto")) {
        const cat = r.categoria || "Sin categoría";
        map.set(cat, (map.get(cat) ?? 0) + r.importe);
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { ingresos: number; gastos: number }>();
    for (const r of records ?? []) {
      const k = monthKey(r.fecha);
      if (!k) continue;
      const cur = map.get(k) ?? { ingresos: 0, gastos: 0 };
      if (r.tipo.toLowerCase().includes("ingreso")) cur.ingresos += r.importe;
      else cur.gastos += r.importe;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([k, v]) => ({ mes: monthLabel(k), ...v }));
  }, [records]);

  const sorted = useMemo(
    () => [...(records ?? [])].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
    [records]
  );

  const rangeLabel =
    range.preset === "custom" || range.preset !== "mes"
      ? fmtRange(range.from, range.to)
      : new Date().toLocaleDateString("es", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* Filtro por rango de fechas */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["mes", "Este mes"],
              ["30d", "30 días"],
              ["anio", "Este año"],
              ["todo", "Todo"],
            ] as [Exclude<RangePreset, "custom">, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition ${
                range.preset === key
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value, preset: "custom" }))}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-zinc-700 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <span className="text-zinc-400">a</span>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value, preset: "custom" }))}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-zinc-700 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </div>
        <p className="mt-2 text-xs capitalize text-zinc-400">{rangeLabel}</p>
      </div>

      {/* Registro rápido */}
      <QuickAdd onSaved={refresh} busy={busy} />

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Saldo</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-lg">
            {formatMoney(totals.saldo)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ingresos</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-lg">
            {formatMoney(totals.ingresos)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Gastos</p>
          <p className="mt-1 truncate text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400 sm:text-lg">
            {formatMoney(totals.gastos)}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Gastos por categoría
          </p>
          {byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">Sin gastos en el rango</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1">
                {byCategory.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-zinc-800 dark:text-zinc-100">
                      {formatMoney(c.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Ingresos vs gastos por mes
          </p>
          {byMonth.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">Sin datos en el rango</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={34} />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ingresos" fill={COLOR_INGRESO} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill={COLOR_GASTO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Movimientos */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Movimientos en el período ({sorted.length})
        </p>
      </div>

      {editing && (
        <RecordForm
          key={editing.row}
          initial={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={(input) => save(input, editing.row)}
        />
      )}

      {records === null ? (
        <p className="py-10 text-center text-sm text-zinc-400">Cargando movimientos…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay movimientos en este período. Agrega uno arriba.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {sorted.map((r) => {
            const isExpense = r.tipo.toLowerCase().includes("gasto");
            return (
              <li
                key={r.row}
                className="flex min-h-16 items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  <span
                    className={`h-9 w-9 flex items-center justify-center rounded-full text-sm font-semibold ${
                      isExpense
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                    }`}
                  >
                    {isExpense ? "−" : "+"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {r.descripcion || r.categoria || "Sin descripción"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.fecha}
                    <span className="mx-1.5">·</span>
                    {r.categoria}
                    {r.subcategoria && (
                      <>
                        <span className="mx-1.5">·</span>
                        {r.subcategoria}
                      </>
                    )}
                    {r.estado === "Pendiente" && (
                      <span className="ml-2 inline-block rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Pendiente
                      </span>
                    )}
                  </p>
                  {r.cuenta && (
                    <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">via {r.cuenta}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      isExpense
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isExpense ? "-" : "+"}
                    {formatMoney(r.importe)}
                  </span>
                  {confirmDelete === r.row ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => remove(r.row)}
                        disabled={busy}
                        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <button
                        onClick={() => setEditing(r)}
                        aria-label="Editar"
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r.row)}
                        aria-label="Eliminar"
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuickAdd({ onSaved, busy }: { onSaved: () => Promise<void>; busy: boolean }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(todayIso());
  const [tipo, setTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [categoria, setCategoria] = useState(categoriasGasto[0]);
  const [cuenta, setCuenta] = useState(metaMedios[0]);
  const [descripcion, setDescripcion] = useState("");
  const [importe, setImporte] = useState("");
  const [saved, setSaved] = useState(false);

  const cats = tipo === "Ingreso" ? categoriasIngreso : categoriasGasto;

  const onTipoChange = (t: "Gasto" | "Ingreso") => {
    setTipo(t);
    setCategoria(t === "Ingreso" ? categoriasIngreso[0] : categoriasGasto[0]);
  };

  const submit = async () => {
    const value = normalizeNumber(importe);
    if (!fecha || value <= 0) return;
    const ok = await fetch("/api/sheets/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, tipo, categoria, descripcion, cuenta, estado: "Hecho", importe: value }),
    }).then(async (res) => {
      if (res.status === 401) {
        router.push("/login");
        return false;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error al guardar");
      return true;
    });
    if (ok) {
      setImporte("");
      setDescripcion("");
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors dark:bg-zinc-900 ${
        tipo === "Ingreso" ? "border-emerald-300 dark:border-emerald-800" : "border-rose-200 dark:border-rose-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Nuevo movimiento</p>
        <div className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["Gasto", "Ingreso"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTipoChange(t)}
              className={`h-8 rounded-full px-4 text-sm font-medium transition ${
                tipo === t
                  ? t === "Gasto"
                    ? "bg-rose-600 text-white"
                    : "bg-emerald-600 text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Importe</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className={`${inputCls} text-base font-semibold tabular-nums`}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Cuenta/Medio</span>
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={inputCls}>
            {metaMedios.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-1 sm:justify-self-end">
          <span className="mb-1 hidden text-xs sm:block">&nbsp;</span>
          <button
            onClick={submit}
            disabled={busy || !importe}
            className={`h-11 w-full rounded-xl px-5 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-50 ${
              saved
                ? "bg-zinc-500"
                : tipo === "Gasto"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {saved ? "Guardado ✓" : busy ? "Guardando…" : tipo === "Gasto" ? "Registrar gasto" : "Registrar ingreso"}
          </button>
        </label>
      </div>
      <div className="mt-2">
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Descripción (opcional) · Enter para guardar"
          className={inputCls}
        />
      </div>
    </div>
  );
}

function RecordForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: Record;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: Record) => void;
}) {
  const [fecha, setFecha] = useState(initial.fecha);
  const [tipo, setTipo] = useState(initial.tipo);
  const [categoria, setCategoria] = useState(initial.categoria);
  const [subcategoria, setSubcategoria] = useState(initial.subcategoria ?? "");
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [cuenta, setCuenta] = useState(initial.cuenta ?? metaMedios[0]);
  const [estado, setEstado] = useState(initial.estado ?? "Hecho");
  const [importe, setImporte] = useState(String(initial.importe));

  const cats = tipo.toLowerCase().includes("ingreso") ? categoriasIngreso : categoriasGasto;
  const subs = tipo.toLowerCase().includes("ingreso") ? subcategoriasIngreso : subcategoriasGasto;

  const onTipoChange = (t: string) => {
    setTipo(t);
    const list = t.toLowerCase().includes("ingreso") ? categoriasIngreso : categoriasGasto;
    setCategoria(list.includes(categoria) ? categoria : list[0]);
    const subList = t.toLowerCase().includes("ingreso") ? subcategoriasIngreso : subcategoriasGasto;
    setSubcategoria(subList.includes(subcategoria) ? subcategoria : "");
  };

  const submit = () => {
    const value = normalizeNumber(importe);
    if (!fecha || !tipo || value === 0) return;
    onSubmit({
      row: initial.row,
      fecha,
      tipo,
      categoria,
      subcategoria: subcategoria || undefined,
      descripcion,
      cuenta,
      estado,
      importe: value,
    });
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-zinc-900">
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">Modificar movimiento</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Tipo</span>
          <select value={tipo} onChange={(e) => onTipoChange(e.target.value)} className={inputCls}>
            <option>Gasto</option>
            <option>Ingreso</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Subcategoría</span>
          <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {subs.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Importe</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            className={`${inputCls} tabular-nums`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Cuenta/Medio</span>
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={inputCls}>
            {metaMedios.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputCls}>
            {estados.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">Descripción</span>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Supermercado, sueldo…"
            className={inputCls}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-xl border border-zinc-200 px-4 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}