import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, mode } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">E</div>
          <h1 className="text-xl font-semibold">Estimate Builder</h1>
          <p className="text-sm text-muted mt-1">Professional estimates in minutes.</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : undefined} initialMode={mode === "signup" ? "signup" : "login"} />
      </div>
    </main>
  );
}
