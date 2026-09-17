"use client";

import { useState, useTransition } from "react";
import { Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { emailEstimate } from "@/lib/estimates/actions";
import { docWords } from "@/lib/utils";
import type { DocumentKind } from "@/generated/prisma/enums";

/**
 * Inline "send by email" form for the Share panel. Sends from the app (Resend) with the public link;
 * the contractor can tweak the recipient and add a personal note. Mount it only while open so state resets.
 */
export function EmailDialog({ estimateId, kind, number, defaultTo, firstName, onClose }: {
  estimateId: string;
  kind: DocumentKind;
  number: string;
  defaultTo: string | null;
  firstName: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [to, setTo] = useState(defaultTo ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { word } = docWords(kind);

  const send = () => {
    setError(null);
    start(async () => {
      const r = await emailEstimate(estimateId, { to, message });
      if (r.ok) { setSent(true); setTimeout(onClose, 1200); } else setError(r.error);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium inline-flex items-center gap-2"><Mail className="h-4 w-4" /> Email {word} {number}</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-black/5" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <Field label="To">
        <Input autoFocus type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@email.com" disabled={pending || sent} />
      </Field>
      <Field label="Message (optional)" hint={`The ${word} link, total and your contact info are added automatically.`}>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder={`Hi ${firstName}, thanks for having me out today. Let me know if you have any questions.`} disabled={pending || sent} maxLength={2000} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={send} disabled={pending || sent || !to}>
          {sent ? <><Check className="h-4 w-4" /> Sent</> : pending ? "Sending…" : <><Mail className="h-4 w-4" /> Send</>}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
