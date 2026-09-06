"use client";

import Link from "next/link";

const googleIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.66v3h3.86c2.26-2.09 3.56-5.17 3.56-9.9z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29A7.3 7.3 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
);

type Props = {
  error?: string | null;
};

export function LoginForm({ error }: Props) {
  return (
    <div className="w-full max-w-sm">
      <Link
        href="/api/auth/login"
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:shadow active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {googleIcon}
        Continúa con Google
      </Link>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error === "denied" && "Acceso cancelado. Inténtalo de nuevo."}
          {error === "state" && "La sesión expiró. Vuelve a intentarlo."}
          {error === "token" && "No se pudo conectar con Google. Inténtalo de nuevo."}
        </p>
      )}
    </div>
  );
}
