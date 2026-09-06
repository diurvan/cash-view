import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Iniciar sesión · cashview",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-10">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Tu control financiero, simple.
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Conecta tu cuenta de Google para ver, registrar y analizar tus ingresos y gastos sin
            esfuerzo.
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm error={error} />
        </Suspense>

        <p className="text-center text-xs leading-5 text-zinc-400 dark:text-zinc-500">
          Al continuar aceptas que cashview acceda a las hojas de cálculo de tu cuenta. Puedes
          desconectar el acceso en cualquier momento desde tu cuenta de Google.
        </p>
      </div>
    </main>
  );
}
