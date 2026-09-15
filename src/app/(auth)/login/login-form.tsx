"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { login, signup, type LoginState } from "./actions";

export function LoginForm({ next, initialMode }: { next?: string; initialMode: "login" | "signup" }) {
  const [mode, setMode] = useState(initialMode);
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<LoginState, FormData>(signup, undefined);

  const isLogin = mode === "login";
  const state = isLogin ? loginState : signupState;
  const pending = isLogin ? loginPending : signupPending;

  return (
    <Card>
      <CardBody className="p-6">
        <form action={isLogin ? loginAction : signupAction} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@company.com" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={6} />
          </Field>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "…" : isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {isLogin ? "New here? " : "Already have an account? "}
          <button type="button" className="text-accent font-medium" onClick={() => setMode(isLogin ? "signup" : "login")}>
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </p>
      </CardBody>
    </Card>
  );
}
