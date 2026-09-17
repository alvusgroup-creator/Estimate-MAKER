"use client";

import { useState, useTransition } from "react";
import { BadgeDollarSign, Check, Copy, CopyPlus, ExternalLink, FilePlus2, FileText, Printer, Receipt, Send, ThumbsDown, ThumbsUp, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { convertToInvoice, deleteEstimate, duplicateEstimate, markInvoicePaid, setEstimateStatus } from "@/lib/estimates/actions";
import type { EstimateDTO } from "@/lib/estimates/dto";
import { EmailDialog } from "./email-dialog";
import { docWords } from "@/lib/utils";

export function EstimateActions({ estimate, publicUrl, emailEnabled }: { estimate: EstimateDTO; publicUrl: string; emailEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const s = estimate.status;
  const inv = estimate.kind === "INVOICE";
  const isEstimate = estimate.kind === "ESTIMATE";
  const { word: docWord, Word } = docWords(estimate.kind);

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (s === "DRAFT") start(() => setEstimateStatus(estimate.id, "SENT"));
  };

  const smsHref = `sms:${estimate.client.phone ?? ""}?&body=${encodeURIComponent(`Hi ${estimate.client.firstName}, here's your ${docWord} ${estimate.number}: ${publicUrl}`)}`;
  const mailHref = `mailto:${estimate.client.email ?? ""}?subject=${encodeURIComponent(`${Word} ${estimate.number}`)}&body=${encodeURIComponent(`Hi ${estimate.client.firstName},\n\nHere's your ${docWord}: ${publicUrl}\n\nLet me know if you have any questions.`)}`;

  return (
    <Card>
      <CardHeader><CardTitle>Share</CardTitle></CardHeader>
      <CardBody className="space-y-2">
        <Button className="w-full" onClick={copy} disabled={pending}>
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link{s === "DRAFT" ? " & mark sent" : ""}</>}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <a href={smsHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-background" onClick={() => s === "DRAFT" && start(() => setEstimateStatus(estimate.id, "SENT"))}>
            <Send className="h-4 w-4" /> Text
          </a>
          {emailEnabled ? (
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-background" onClick={() => setEmailOpen((o) => !o)}>
              <Send className="h-4 w-4" /> Email
            </button>
          ) : (
            <a href={mailHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-background" onClick={() => s === "DRAFT" && start(() => setEstimateStatus(estimate.id, "SENT"))}>
              <Send className="h-4 w-4" /> Email
            </a>
          )}
        </div>
        {emailOpen && <EmailDialog estimateId={estimate.id} kind={estimate.kind} number={estimate.number} defaultTo={estimate.client.email} firstName={estimate.client.firstName} onClose={() => setEmailOpen(false)} />}
        <div className="grid grid-cols-2 gap-2">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-black/5">
            <ExternalLink className="h-4 w-4" /> Open link
          </a>
          <a href={`${publicUrl}?print=1`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-black/5">
            <Printer className="h-4 w-4" /> PDF / Print
          </a>
        </div>

        <div className="border-t border-border pt-3 mt-1 space-y-2">
          {inv && (s === "SENT" || s === "VIEWED" || s === "DRAFT") && (
            <Button className="w-full bg-success hover:bg-success/90 text-white" disabled={pending} onClick={() => start(() => markInvoicePaid(estimate.id, true))}><BadgeDollarSign className="h-4 w-4" /> Mark as paid</Button>
          )}
          {inv && s === "PAID" && (
            <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(() => markInvoicePaid(estimate.id, false))}><Undo2 className="h-4 w-4" /> Mark as unpaid</Button>
          )}
          {isEstimate && s === "ACCEPTED" && (
            <Link href={`/estimates/${estimate.id}/change-order`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-background"><FilePlus2 className="h-4 w-4" /> New change order</Link>
          )}
          {isEstimate && s === "ACCEPTED" && (
            estimate.invoiceId ? (
              <Link href={`/estimates/${estimate.invoiceId}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"><Receipt className="h-4 w-4" /> Open invoice</Link>
            ) : (
              <Button className="w-full" disabled={pending} onClick={() => start(() => convertToInvoice(estimate.id))}><Receipt className="h-4 w-4" /> Convert to invoice</Button>
            )
          )}
          {inv && estimate.sourceEstimateId && (
            <Link href={`/estimates/${estimate.sourceEstimateId}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted hover:bg-black/5"><FileText className="h-4 w-4" /> View source estimate</Link>
          )}
          {estimate.parent && (
            <Link href={`/estimates/${estimate.parent.id}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted hover:bg-black/5"><FileText className="h-4 w-4" /> View estimate {estimate.parent.number}</Link>
          )}
          {!inv && (s === "SENT" || s === "VIEWED") && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="text-success" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "ACCEPTED"))}><ThumbsUp className="h-4 w-4" /> Accepted</Button>
              <Button variant="secondary" className="text-danger" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "DECLINED"))}><ThumbsDown className="h-4 w-4" /> Declined</Button>
            </div>
          )}
          {!inv && (s === "ACCEPTED" || s === "DECLINED" || s === "EXPIRED") && (
            <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "SENT"))}><Undo2 className="h-4 w-4" /> Reopen</Button>
          )}
          {!inv && <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(() => duplicateEstimate(estimate.id))}><CopyPlus className="h-4 w-4" /> Duplicate</Button>}
          {s === "DRAFT" && (
            <Button variant="danger" className="w-full" disabled={pending} onClick={() => confirm("Delete this draft?") && start(() => deleteEstimate(estimate.id))}><Trash2 className="h-4 w-4" /> Delete draft</Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
