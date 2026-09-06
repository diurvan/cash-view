import { AppHeader } from "@/components/app-header";
import { DashboardView } from "@/components/dashboard-view";

export const metadata = {
  title: "Dashboard · cashview",
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader />

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <DashboardView />
      </section>
    </main>
  );
}