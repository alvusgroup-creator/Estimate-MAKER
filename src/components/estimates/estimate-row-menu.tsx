"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { BadgeDollarSign, Copy, CopyPlus, ExternalLink, Eye, FilePlus2, Mail, MessageSquare, Pencil, Printer, Receipt, Send, ThumbsDown, ThumbsUp, Trash2, Undo2 } from "lucide-react";
import { ContextMenu, type MenuItem } from "@/components/ui/context-menu";
import { convertToInvoice, deleteEstimate, duplicateEstimate, markInvoicePaid, setEstimateStatus } from "@/lib/estimates/actions";
import type { EstimateStatus, DocumentKind } from "@/generated/prisma/enums";
import { docWords } from "@/lib/utils";

export type EstimateRowData = {
  id: string;
  number: string;
  kind: DocumentKind;
  status: EstimateStatus;
  publicToken: string;
  invoiceId?: string | null;
  client: { firstName: string; phone: string | null; email: string | null };
};

/** Builds the right-click menu for an estimate/invoice anywhere it appears as a row. */
export function useEstimateMenu(e: EstimateRowData, opts?: { includeOpen?: boolean }): MenuItem[] {
  const router = useRouter();
  const [, start] = useTransition();
  const inv = e.kind === "INVOICE";
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${e.publicToken}`;
  const { word: docWord, Word } = docWords(e.kind);
  const editable = e.status !== "ACCEPTED" && e.status !== "PAID";
  const open = e.status === "SENT" || e.status === "VIEWED";

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    if (e.status === "DRAFT") start(() => setEstimateStatus(e.id, "SENT"));
  };
  const markSentIfDraft = () => { if (e.status === "DRAFT") start(() => setEstimateStatus(e.id, "SENT")); };

  const items: MenuItem[] = [
    { type: "label", label: `${Word} ${e.number}` },
    ...(opts?.includeOpen === false ? [] : [{ label: "Open", icon: Eye, href: `/estimates/${e.id}` } satisfies MenuItem]),
    { label: "Edit", icon: Pencil, href: `/estimates/${e.id}/edit`, disabled: !editable, hint: !editable ? "locked" : undefined },
    { type: "separator" },
    { label: e.status === "DRAFT" ? "Copy link & mark sent" : "Copy link", icon: Copy, onSelect: copyLink },
    { label: "Text to client", icon: MessageSquare, href: `sms:${e.client.phone ?? ""}?&body=${encodeURIComponent(`Hi ${e.client.firstName}, here's your ${docWord} ${e.number}: ${url}`)}`, disabled: !e.client.phone, onSelect: markSentIfDraft },
    { label: "Email to client", icon: Mail, href: `mailto:${e.client.email ?? ""}?subject=${encodeURIComponent(`${Word} ${e.number}`)}&body=${encodeURIComponent(`Hi ${e.client.firstName},\n\nHere's your ${docWord}: ${url}`)}`, disabled: !e.client.email, onSelect: markSentIfDraft },
    { label: "Open public link", icon: ExternalLink, href: url, external: true },
    { label: "Print / PDF", icon: Printer, href: `${url}?print=1`, external: true },
    { type: "separator" },
  ];

  if (inv) {
    if (e.status !== "PAID") items.push({ label: "Mark as paid", icon: BadgeDollarSign, onSelect: () => start(() => markInvoicePaid(e.id)) });
  } else {
    if (e.status === "DRAFT") items.push({ label: "Mark as sent", icon: Send, onSelect: () => start(() => setEstimateStatus(e.id, "SENT")) });
    if (open) {
      items.push({ label: "Mark accepted", icon: ThumbsUp, onSelect: () => start(() => setEstimateStatus(e.id, "ACCEPTED")) });
      items.push({ label: "Mark declined", icon: ThumbsDown, onSelect: () => start(() => setEstimateStatus(e.id, "DECLINED")) });
    }
    if (e.status === "ACCEPTED" && e.kind === "ESTIMATE") {
      items.push({ label: "New change order", icon: FilePlus2, href: `/estimates/${e.id}/change-order` });
      items.push(e.invoiceId
        ? { label: "Open invoice", icon: Receipt, href: `/estimates/${e.invoiceId}` }
        : { label: "Convert to invoice", icon: Receipt, onSelect: () => start(() => convertToInvoice(e.id)) });
    }
    if (e.status === "ACCEPTED" || e.status === "DECLINED" || e.status === "EXPIRED") {
      items.push({ label: "Reopen", icon: Undo2, onSelect: () => start(() => setEstimateStatus(e.id, "SENT")) });
    }
    items.push({ label: "Duplicate", icon: CopyPlus, onSelect: () => start(() => duplicateEstimate(e.id)) });
  }

  if (e.status === "DRAFT") {
    items.push({ type: "separator" });
    items.push({ label: "Delete draft", icon: Trash2, danger: true, onSelect: () => { if (confirm(`Delete ${e.number}?`)) start(async () => { await deleteEstimate(e.id); router.refresh(); }); } });
  }

  return items;
}

export function EstimateRowMenu({ estimate, children, includeOpen, as }: { estimate: EstimateRowData; children: ReactNode; includeOpen?: boolean; as?: "div" | "li" }) {
  const items = useEstimateMenu(estimate, { includeOpen });
  return <ContextMenu items={items} as={as}>{children}</ContextMenu>;
}

