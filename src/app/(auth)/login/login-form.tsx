"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { login, signup, type LoginState } from "./actions";

type Mode = "login" | "signup";

/**
 * InvoiceFly-style entry: pick a method (Google / email), then the email form expands in place.
 * The top-right pill flips between "Sign in" and "Create account".
 */
export function LoginForm({ next, initialMode }: { next?: string; initialMode: Mode }) {
  const mode = initialMode; // switched via the URL (?mode=signup) so the header pill stays in sync
  const [method, setMethod] = useState<"pick" | "email">("pick");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<LoginState, FormData>(signup, undefined);

  const isLogin = mode === "login";
  const state = isLogin ? loginState : signupState;
  const pending = isLogin ? loginPending : signupPending;

  async function google() {
    setOauthError(null);
    const supabase = createSupabaseBrowser();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setOauthError("Google sign-in isn't available right now. Use your email instead.");
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight leading-tight">
          {isLogin ? "Welcome back" : <>Try EasyInvoice<br />for free</>}
        </h1>
        <p className="text-muted mt-2">{isLogin ? "Sign in to your estimates, clients and invoices." : "Build and send professional estimates in minutes and get to yes faster."}</p>
      </div>

      {method === "pick" ? (
        <>
          <p className="font-medium mb-3">{isLogin ? "Sign in with:" : "Continue with one of these:"}</p>
          <div className="space-y-2.5">
            <MethodButton onClick={google} icon={<GoogleMark />} label="Google" />
            <MethodButton onClick={() => setMethod("email")} icon={<Mail className="h-4 w-4" />} label="Email" primary={!isLogin} />
          </div>
          {oauthError && <p className="mt-3 text-sm text-danger">{oauthError}</p>}
        </>
      ) : (
        <form action={isLogin ? loginAction : signupAction} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@company.com" autoFocus className="h-12" />
          </Field>
          <Field label="Password" hint={isLogin ? undefined : "At least 6 characters"}>
            <Input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={6} className="h-12" />
          </Field>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending}>
            {pending ? "…" : isLogin ? "Sign in" : "Create account"}
          </Button>
          <button type="button" className="block w-full text-center text-sm text-muted hover:text-foreground" onClick={() => setMethod("pick")}>Other options</button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link href={isLogin ? "/login?mode=signup" : "/login"} className="text-accent font-medium">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}

function MethodButton({ onClick, icon, label, primary }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 h-14 text-[15px] font-medium transition-colors",
        primary ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-background hover:bg-black/5 text-foreground",
      )}
    >
      <span className={cn("grid place-items-center h-5 w-5", primary && "text-white")}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="h-4 w-4 opacity-70" />
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1C3.3 21.4 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.5l4 3.1c1-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
