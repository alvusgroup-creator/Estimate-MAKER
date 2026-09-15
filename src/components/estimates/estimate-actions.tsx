"use client";

import { useState, useTransition } from "react";
import { Check, Copy, CopyPlus, ExternalLink, Printer, Send, ThumbsDown, ThumbsUp, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteEstimate, duplicateEstimate, setEstimateStatus } from "@/lib/estimates/actions";
import type { EstimateDTO } from "@/lib/estimates/dto";

export function EstimateActions({ estimate, publicUrl }: { estimate: EstimateDTO; publicUrl: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const s = estimate.status;

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (s === "DRAFT") start(() => setEstimateStatus(estimate.id, "SENT"));
  };

  const smsHref = `sms:${estimate.client.phone ?? ""}?&body=${encodeURIComponent(`Hi ${estimate.client.firstName}, here's your estimate ${estimate.number}: ${publicUrl}`)}`;
  const mailHref = `mailto:${estimate.client.email ?? ""}?subject=${encodeURIComponent(`Estimate ${estimate.number}`)}&body=${encodeURIComponent(`Hi ${estimate.client.firstName},\n\nHere's your estimate: ${publicUrl}\n\nLet me know if you have any questions.`)}`;

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
          <a href={mailHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium hover:bg-background" onClick={() => s === "DRAFT" && start(() => setEstimateStatus(estimate.id, "SENT"))}>
            <Send className="h-4 w-4" /> Email
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-black/5">
            <ExternalLink className="h-4 w-4" /> Open link
          </a>
          <a href={`${publicUrl}?print=1`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-black/5">
            <Printer className="h-4 w-4" /> PDF / Print
          </a>
        </div>

        <div className="border-t border-border pt-3 mt-1 space-y-2">
          {(s === "SENT" || s === "VIEWED") && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="text-success" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "ACCEPTED"))}><ThumbsUp className="h-4 w-4" /> Accepted</Button>
              <Button variant="secondary" className="text-danger" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "DECLINED"))}><ThumbsDown className="h-4 w-4" /> Declined</Button>
            </div>
          )}
          {(s === "ACCEPTED" || s === "DECLINED" || s === "EXPIRED") && (
            <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(() => setEstimateStatus(estimate.id, "SENT"))}><Undo2 className="h-4 w-4" /> Reopen</Button>
          )}
          <Button variant="secondary" className="w-full" disabled={pending} onClick={() => start(() => duplicateEstimate(estimate.id))}><CopyPlus className="h-4 w-4" /> Duplicate</Button>
          {s === "DRAFT" && (
            <Button variant="danger" className="w-full" disabled={pending} onClick={() => confirm("Delete this draft?") && start(() => deleteEstimate(estimate.id))}><Trash2 className="h-4 w-4" /> Delete draft</Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
