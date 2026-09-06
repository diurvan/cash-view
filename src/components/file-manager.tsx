"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { disconnectDrive } from "@/lib/actions";
import {
  downloadFile,
  exportFile,
  fsaSupported,
  getFileName,
  importFile,
  isLinkedToFile,
  newFile,
  openFileFromDisk,
  saveFileToDisk,
  unlinkFile,
} from "@/lib/local-db";

type DriveStatus =
  | { state: "loading" }
  | { state: "off" }
  | { state: "on"; email: string };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function notifyDataChanged() {
  window.dispatchEvent(new Event("cvw-data-changed"));
}

export function FileManager() {
  const [fileName, setFileName] = useState("CashView.cvw");
  const [linked, setLinked] = useState(false);
  const [fsa, setFsa] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drive, setDrive] = useState<DriveStatus>({ state: "loading" });
  const fileInput = useRef<HTMLInputElement>(null);

  const reloadFileMeta = useCallback(async () => {
    setFileName(await getFileName());
    setLinked(await isLinkedToFile());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFsa(fsaSupported());
      try {
        await reloadFileMeta();
      } catch {
        // sin almacenamiento local
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadFileMeta]);

  const checkDrive = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("no");
      const d = await res.json();
      if (d.authenticated && d.user?.email) {
        setDrive({ state: "on", email: d.user.email });
      } else {
        setDrive({ state: "off" });
      }
    } catch {
      setDrive({ state: "off" });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await checkDrive();
    })();
  }, [checkDrive]);

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>, okText: string) => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        await fn();
        setNotice(okText);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la operación.");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const pulse = () => {
    window.dispatchEvent(new Event("cvw-file-changed"));
  };

  async function onExport() {
    await run("export", async () => {
      const name = (await getFileName()).endsWith(".cvw") ? await getFileName() : `${await getFileName()}.cvw`;
      downloadFile(await exportFile(), name);
    }, "Archivo .cvw descargado.");
  }

  async function onImport(file: File) {
    await run(
      "import",
      async () => {
        const buf = await file.arrayBuffer();
        if (!buf.byteLength) throw new Error("El archivo está vacío.");
        await importFile(new Uint8Array(buf));
        await reloadFileMeta();
      },
      "Archivo importado y en uso."
    );
    notifyDataChanged();
    pulse();
  }

  async function onNew() {
    if (!window.confirm("¿Crear un archivo nuevo? Se perderá la base actual de este navegador.")) return;
    await run(
      "nuevo",
      async () => {
        await newFile();
        await reloadFileMeta();
      },
      "Archivo nuevo creado con la plantilla."
    );
    notifyDataChanged();
    pulse();
  }

  async function onOpen() {
    await run("abrir", async () => {
      await openFileFromDisk();
      await reloadFileMeta();
    }, "Archivo abierto. De aquí en más se autoguarda tras cada cambio.");
    notifyDataChanged();
    pulse();
  }

  async function onSaveAs() {
    await run("guardar", async () => {
      await saveFileToDisk();
      await reloadFileMeta();
    }, "Archivo guardado. De aquí en más se autoguarda tras cada cambio.");
    notifyDataChanged();
    pulse();
  }

  async function onUnlink() {
    await run("desvincular", async () => {
      await unlinkFile();
      await reloadFileMeta();
    }, "Copia local en uso. El archivo en disco ya no se modifica.");
    pulse();
  }

  async function onDriveSave() {
    await run(
      "drive-save",
      async () => {
        const bytes = await exportFile();
        const name = (await getFileName()).endsWith(".cvw") ? await getFileName() : `${await getFileName()}.cvw`;
        const res = await fetch("/api/drive/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bytes: b64(bytes), name }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "No se pudo guardar en Drive.");
        }
      },
      "Copia guardada en tu Google Drive."
    );
  }

  async function onDriveLoad() {
    await run(
      "drive-load",
      async () => {
        const res = await fetch("/api/drive/load");
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "No se pudo descargar desde Drive.");
        }
        const d = await res.json();
        await importFile(b64ToBytes(d.bytes));
        await reloadFileMeta();
      },
      "Copia de Drive abierta y en uso."
    );
    notifyDataChanged();
    pulse();
  }

  async function onDriveDisconnect() {
    await disconnectDrive();
    setDrive({ state: "off" });
  }

  const cmdCls =
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {/* Archivo .cvw */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Archivo</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-zinc-400">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  linked ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              />
              <span className="truncate">{fileName}</span>
              <span>{linked ? "· en tu disco (autoguardado)" : "· copia en este navegador"}</span>
            </p>
          </div>
          <button
            onClick={onNew}
            disabled={busy !== null}
            className={`${cmdCls} !border-rose-200 !text-rose-600 hover:!bg-rose-50 dark:!border-rose-900`}
          >
            Nuevo
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={onExport} disabled={busy !== null} className={cmdCls}>
            Exportar .cvw
          </button>
          <button onClick={() => fileInput.current?.click()} disabled={busy !== null} className={cmdCls}>
            Importar .cvw
          </button>
          {fsa && (
            <>
              <button onClick={onOpen} disabled={busy !== null} className={cmdCls}>
                Abrir archivo…
              </button>
              <button onClick={onSaveAs} disabled={busy !== null} className={cmdCls}>
                Guardar en archivo…
              </button>
              {linked && (
                <button onClick={onUnlink} disabled={busy !== null} className={`${cmdCls} !text-rose-600`}>
                  Desvincular
                </button>
              )}
            </>
          )}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".cvw,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
      </section>

      {/* Copia en Google Drive (opcional) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Copia en Google Drive</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Una copia de seguridad de tu archivo .cvw. Google solo ve este archivo (scope drive.file).
            </p>
          </div>
          {drive.state === "on" && (
            <button
              onClick={onDriveDisconnect}
              className="shrink-0 text-xs font-medium text-zinc-400 transition hover:text-rose-600"
            >
              Desconectar
            </button>
          )}
        </div>

        {drive.state === "loading" ? (
          <p className="text-sm text-zinc-400">Comprobando…</p>
        ) : drive.state === "off" ? (
          <a
            href="/api/auth/login?next=/catalog"
            className="inline-flex h-10 items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11.3 11.3 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
              />
            </svg>
            Conectar con Google
          </a>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Conectado como <span className="font-medium">{drive.email}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={onDriveSave} disabled={busy !== null} className={cmdCls}>
                Guardar en Drive
              </button>
              <button onClick={onDriveLoad} disabled={busy !== null} className={cmdCls}>
                Descargar desde Drive
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}