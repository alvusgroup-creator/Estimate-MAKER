"use client";

import { useState, useTransition } from "react";
import { Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { respondToEstimate } from "./actions";
import type { EstimateStatus } from "@/generated/prisma/enums";

export function PublicActions({ token, status, canRespond, orgName, orgPhone, orgEmail }: {
  token: string;
  status: EstimateStatus;
  canRespond: boolean;
  orgName: string;
  orgPhone: string | null;
  orgEmail: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "accept" | "decline" | "done">("idle");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");

  const submit = (decision: "ACCEPTED" | "DECLINED") =>
    start(async () => {
      setError(null);
      const r = await respondToEstimate(token, decision, { signerName: name, reason });
      if (!r.ok) return setError(r.error);
      setMode("done");
    });

  return (
    <div className="px-4 sm:px-0 py-6 space-y-4">
      {status === "ACCEPTED" || mode === "done" ? (
        <div className="rounded-xl bg-white p-5 text-center border border-neutral-200">
          <div className="mx-auto h-10 w-10 rounded-full bg-green-100 text-green-700 grid place-items-center mb-2"><Check className="h-5 w-5" /></div>
          <p className="font-medium">{status === "DECLINED" || (mode === "done" && !name) ? "Response recorded" : "Estimate accepted"}</p>
          <p className="text-sm text-neutral-600 mt-1">{orgName} has been notified{orgPhone ? ` · ${orgPhone}` : ""}.</p>
        </div>
      ) : status === "DECLINED" ? (
        <div className="rounded-xl bg-white p-5 text-center border border-neutral-200 text-sm text-neutral-600">This estimate was declined. Contact {orgName}{orgPhone ? ` at ${orgPhone}` : ""} to revisit it.</div>
      ) : canRespond && mode === "idle" ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="bg-green-700 hover:bg-green-800" onClick={() => setMode("accept")}>Accept estimate</Button>
          <Button size="lg" variant="secondary" onClick={() => setMode("decline")}>Decline</Button>
        </div>
      ) : mode === "accept" ? (
        <div className="rounded-xl bg-white p-5 border border-neutral-200 space-y-3">
          <p className="font-medium">Accept this estimate</p>
          <p className="text-sm text-neutral-600">Type your full name to confirm. This lets {orgName} schedule the work.</p>
          <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button className="bg-green-700 hover:bg-green-800 flex-1" disabled={pending || name.trim().length < 2} onClick={() => submit("ACCEPTED")}>{pending ? "…" : "Confirm acceptance"}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </div>
      ) : mode === "decline" ? (
        <div className="rounded-xl bg-white p-5 border border-neutral-200 space-y-3">
          <p className="font-medium">Decline this estimate</p>
          <Textarea placeholder="Optional — let them know why (price, timing, went another way…)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={pending} onClick={() => submit("DECLINED")}>{pending ? "…" : "Send response"}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Questions? {[orgPhone, orgEmail].filter(Boolean).join(" · ") || `Contact ${orgName}`}</span>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 hover:text-neutral-800"><Printer className="h-3.5 w-3.5" /> Print / save PDF</button>
      </div>
    </div>
  );
}
