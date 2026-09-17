"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Eraser, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { respondToEstimate } from "./actions";
import { SignatureCanvas, clearSignature } from "@/components/ui/signature-canvas";
import type { DocumentKind, EstimateStatus } from "@/generated/prisma/enums";
import { docWords } from "@/lib/utils";

export function PublicActions({ token, status, kind, canRespond, orgName, orgPhone, orgEmail }: {
  token: string;
  status: EstimateStatus;
  kind: DocumentKind;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const { word, Word } = docWords(kind);

  const submit = (decision: "ACCEPTED" | "DECLINED") =>
    start(async () => {
      setError(null);
      const signatureDataUrl = decision === "ACCEPTED" && drawn ? canvasRef.current?.toDataURL("image/png") : null;
      const r = await respondToEstimate(token, decision, { signerName: name, signatureDataUrl, reason });
      if (!r.ok) return setError(r.error);
      setMode("done");
    });

  return (
    <div className="px-4 sm:px-0 py-6 space-y-4">
      {kind === "INVOICE" ? (
        <div className="rounded-xl bg-white p-5 text-center border border-neutral-200 text-sm text-neutral-600">
          {status === "PAID" ? "This invoice has been paid. Thank you!" : `To pay, contact ${orgName}${orgPhone ? ` at ${orgPhone}` : ""}.`}
        </div>
      ) : status === "ACCEPTED" || mode === "done" ? (
        <div className="rounded-xl bg-white p-5 text-center border border-neutral-200">
          <div className="mx-auto h-10 w-10 rounded-full bg-green-100 text-green-700 grid place-items-center mb-2"><Check className="h-5 w-5" /></div>
          <p className="font-medium">{status === "DECLINED" || (mode === "done" && !name) ? "Response recorded" : `${Word} accepted`}</p>
          <p className="text-sm text-neutral-600 mt-1">{orgName} has been notified{orgPhone ? ` · ${orgPhone}` : ""}.</p>
        </div>
      ) : status === "DECLINED" ? (
        <div className="rounded-xl bg-white p-5 text-center border border-neutral-200 text-sm text-neutral-600">This {word} was declined. Contact {orgName}{orgPhone ? ` at ${orgPhone}` : ""} to revisit it.</div>
      ) : canRespond && mode === "idle" ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" className="bg-green-700 hover:bg-green-800" onClick={() => setMode("accept")}>Accept {word}</Button>
          <Button size="lg" variant="secondary" onClick={() => setMode("decline")}>Decline</Button>
        </div>
      ) : mode === "accept" ? (
        <div className="rounded-xl bg-white p-5 border border-neutral-200 space-y-3">
          <p className="font-medium">Accept this {word}</p>
          <p className="text-sm text-neutral-600">Type your full name to confirm. This lets {orgName} schedule the work.</p>
          <Input placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Signature <span className="text-neutral-400">(optional)</span></span>
              {drawn && (
                <button type="button" onClick={() => { clearSignature(canvasRef.current); setDrawn(false); }} className="inline-flex items-center gap-1 hover:text-neutral-800"><Eraser className="h-3.5 w-3.5" /> Clear</button>
              )}
            </div>
            <SignatureCanvas canvasRef={canvasRef} dirty={drawn} onDirty={() => setDrawn(true)} placeholder="Sign here with your finger" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button className="bg-green-700 hover:bg-green-800 flex-1" disabled={pending || name.trim().length < 2} onClick={() => submit("ACCEPTED")}>{pending ? "…" : "Confirm acceptance"}</Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </div>
      ) : mode === "decline" ? (
        <div className="rounded-xl bg-white p-5 border border-neutral-200 space-y-3">
          <p className="font-medium">Decline this {word}</p>
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
