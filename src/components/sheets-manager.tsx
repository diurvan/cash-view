"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SheetFile = {
  id: string;
  name: string;
  url: string;
  modifiedTime?: string | null;
};

type InspectResult = {
  dataTab: string;
  valid: boolean;
  check: { tab: string | null; found: string[]; missing: string[] };
  structure: { sheet: string; headers: string[]; samples: string[][] }[];
};

type Props = {
  current?: string | null;
};

export function SheetsManager({ current }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<SheetFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sheets");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Error al listar");
        }
        const d = await res.json();
        if (!cancelled) {
          setError(null);
          setFiles(d.files);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar tus hojas.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const select = async (id: string) => {
    setBusy(true);
    setError(null);
    setErrorLink(null);
    try {
      const res = await fetch("/api/sheets/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErrorLink(d?.link ?? null);
        throw new Error(d?.error ?? "No se pudo seleccionar.");
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo seleccionar la hoja.");
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets/create", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "No se pudo crear la hoja.");
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la hoja.");
    } finally {
      setCreating(false);
    }
  };

  const inspect = async (id: string) => {
    setInspectId(id);
    setInspectError(null);
    setInspectResult(null);
    try {
      const res = await fetch(`/api/sheets/structure?id=${encodeURIComponent(id)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "No se pudo analizar.");
      }
      const d = await res.json();
      setInspectResult(d);
    } catch (e) {
      setInspectError(e instanceof Error ? e.message : "No se pudo analizar la hoja.");
    } finally {
      setInspectId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          {errorLink && (
            <a
              href={errorLink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
            >
              Activar Google Sheets API
            </a>
          )}
        </div>
      )}

      {inspectResult && (
        <DetailsPanel
          result={inspectResult}
          error={inspectError}
          onClose={() => setInspectResult(null)}
        />
      )}

      <button
        onClick={createNew}
        disabled={creating || busy}
        className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-emerald-600 bg-emerald-600 px-5 text-left text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">
          +
        </span>
        <span>
          <span className="block text-base font-semibold">
            {creating ? "Creando tu hoja…" : "Crear mi hoja con la plantilla"}
          </span>
          <span className="block text-sm text-emerald-50/90">
            Se crea en tu Google Drive y listo para usar.
          </span>
        </span>
      </button>

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          O elige una existente
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </p>
        <p className="mb-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          Solo podrás seleccionar archivos con la estructura de CashView (pestaña de datos con{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-200">Fecha</strong>,{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-200">Tipo</strong> e{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-200">Importe</strong>). La{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">lupa (Analizar)</span> inspecciona un
          archivo para ver por qué sería aceptado o rechazado.
        </p>

        {files === null ? (
          <p className="py-8 text-center text-sm text-zinc-400">Cargando tus hojas…</p>
        ) : files.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            No encontré hojas de cálculo en tu Drive. Usa el botón de arriba para crear una.
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => {
              const isCurrent = current === f.name;
              return (
                <li key={f.id}>
                  <div className="flex items-stretch gap-2">
                    <button
                      onClick={() => select(f.id)}
                      disabled={busy}
                      className="flex min-h-16 w-full flex-col justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50/50 active:scale-[0.99] disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            aria-hidden="true"
                          >
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <path d="M3 10h18M9 4v16" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {f.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {isCurrent
                              ? "Hoja actual · toca para abrir"
                              : f.modifiedTime
                                ? new Date(f.modifiedTime).toLocaleDateString("es")
                                : ""}
                          </p>
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="mt-2 self-start rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 sm:mt-0">
                          En uso ✓
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => inspect(f.id)}
                      disabled={inspectId === f.id}
                      title="Analizar estructura"
                      aria-label="Analizar estructura"
                      className="flex w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 shadow-sm transition hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                    >
                      {inspectId === f.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-600" />
                      ) : (
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DetailsPanel({
  result,
  error,
  onClose,
}: {
  result: InspectResult | null;
  error: string | null;
  onClose: () => void;
}) {
  if (!result) return null;
  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Análisis de estructura
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Pestaña de datos: <span className="font-medium text-emerald-700 dark:text-emerald-400">{result.dataTab || "ninguna"}</span>
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
          Cerrar
        </button>
      </div>

      {result.valid ? (
        <p className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Válido: listo para usar en CashView ✓
        </p>
      ) : (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          No es seleccionable. Falta: <strong>{result.check.missing.join(", ")}</strong> en la pestaña de
          datos.
        </p>
      )}

      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

      <ul className="mb-3 space-y-1">
        {result.structure.map((s) => (
          <li key={s.sheet} className="text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">{s.sheet}</span>
            {s.headers.length > 0 ? (
              <span className="text-zinc-400">: {s.headers.join(" · ")}</span>
            ) : (
              <span className="text-zinc-400"> (sin encabezados)</span>
            )}
          </li>
        ))}
      </ul>

      <details>
        <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          Ver muestra de datos (JSON)
        </summary>
        <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}