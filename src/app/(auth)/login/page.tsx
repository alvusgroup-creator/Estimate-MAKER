import Link from "next/link";
import { LoginForm } from "./login-form";
import { BrandMark, SHELL_PHOTOS, SplitShell } from "@/components/auth/split-shell";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next, mode } = await searchParams;
  const signup = mode === "signup";
  return (
    <SplitShell
      photo={SHELL_PHOTOS.crew}
      aside={
        <div className="absolute inset-x-0 bottom-0 hidden lg:block p-10 text-white bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-2xl font-semibold leading-tight max-w-md">Estimates your customers can accept and sign from their phone.</p>
          <p className="mt-2 text-white/80 max-w-md">Built for general contractors, remodelers, painters, flooring and exterior crews.</p>
        </div>
      }
    >
      <header className="flex items-center justify-between">
        <BrandMark />
        <Link href={signup ? "/login" : "/login?mode=signup"} className="rounded-full bg-background px-5 h-11 inline-flex items-center text-sm font-medium hover:bg-black/5">
          {signup ? "Sign in" : "Create account"}
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center py-10">
        <LoginForm next={typeof next === "string" ? next : undefined} initialMode={signup ? "signup" : "login"} />
      </div>
      <p className="text-center text-xs text-muted">Free to start · No credit card needed</p>
    </SplitShell>
  );
}
