import Link from "next/link";
import { FileManager } from "@/components/file-manager";
import { AppSettings } from "@/components/app-settings";
import { CatalogManager } from "@/components/catalog-manager";

export const metadata = {
  title: "Categorías y cuentas · cashview",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
          <div className="text-center">
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Archivo y catálogo
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tu base .cvw, categorías y cuentas
            </p>
          </div>
          <span className="w-16" />
        </div>
      </header>

      <section className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        {error === "noconfig" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            La copia en Google Drive no está configurada: faltan GOOGLE_CLIENT_ID/SECRET en el
            servidor. La app funciona igual con tu archivo local .cvw.
          </p>
        )}
        <FileManager />
        <AppSettings />
        <CatalogManager />
      </section>
    </main>
  );
}