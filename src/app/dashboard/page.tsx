import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { DashboardView } from "@/components/dashboard-view";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";

export const metadata = {
  title: "Dashboard · cashview",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const initial = (session.name ?? session.email ?? "?").charAt(0).toUpperCase();
  const hasSheet = Boolean(session.spreadsheetId);

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link href="/dashboard">
            <Logo size={26} />
          </Link>

          <div className="flex items-center gap-2">
            {hasSheet && session.spreadsheetName && (
              <div className="hidden min-w-0 items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800 sm:flex">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="max-w-40 truncate text-xs text-zinc-600 dark:text-zinc-300">
                  {session.spreadsheetName}
                </span>
              </div>
            )}

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              {initial}
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {!hasSheet ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
            <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              Conecta tu hoja de cálculo
            </h2>
            <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
              Necesitas elegir (o crear) la hoja donde llevaremos tus ingresos y gastos. Toma menos de un minuto.
            </p>
            <Link
              href="/sheets"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 active:scale-[0.99]"
            >
              Elegir mi hoja
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-300">
              {session.spreadsheetName}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {session.spreadsheetUrl && (
                <a
                  href={session.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 10h18M9 4v16" />
                  </svg>
                  Abrir
                </a>
              )}
              <Link
                href="/sheets"
                className="inline-flex h-9 items-center rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cambiar
              </Link>
            </div>
          </div>
        )}

        {hasSheet && <DashboardView />}
      </section>
    </main>
  );
}