import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SheetsManager } from "@/components/sheets-manager";

export const metadata = {
  title: "Tu hoja de cálculo · cashview",
};

export default async function SheetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Elige tu hoja de cálculo
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          La que selecciones será donde guardes tus ingresos y gastos.
        </p>
      </header>

      <section className="mx-auto max-w-2xl px-4 pt-6">
        <SheetsManager current={session.spreadsheetName ?? null} />
      </section>
    </main>
  );
}