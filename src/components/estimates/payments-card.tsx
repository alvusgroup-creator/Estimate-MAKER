"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { deletePayment, recordPayment } from "@/lib/estimates/actions";
import { formatMoney } from "@/lib/estimates/calc";
import type { PaymentDTO } from "@/lib/estimates/dto";

const METHODS: { value: string; label: string }[] = [
  { value: "", label: "Method (optional)" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "ZELLE", label: "Zelle" },
  { value: "VENMO", label: "Venmo" },
  { value: "OTHER", label: "Other" },
];
const methodLabel = (m: string | null) => METHODS.find((x) => x.value === m)?.label ?? null;

/**
 * Ledger for one invoice: deposit, progress payments, final. Recording the last dollar flips the
 * invoice to PAID; deleting a payment flips it back. Balance is total − Σ payments.
 */
export function PaymentsCard({ invoiceId, total, payments, currency, locale }: {
  invoiceId: string;
  total: number;
  payments: PaymentDTO[];
  currency: string;
  locale: string;
}) {
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency, locale);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const today = new Date().toISOString().slice(0, 10);

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await recordPayment(invoiceId, { amount: fd.get("amount"), paidAt: fd.get("paidAt"), method: fd.get("method") || null, note: fd.get("note") });
      if (!r.ok) return setError(r.error);
      setAdding(false);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        {balance > 0 && !adding && <button type="button" className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Record payment</button>}
      </CardHeader>
      <CardBody className="p-0">
        {payments.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.note || methodLabel(p.method) || "Payment"}</span>
                  <span className="block text-xs text-muted">{new Date(p.paidAt).toLocaleDateString(locale, { dateStyle: "medium" })}{p.note && methodLabel(p.method) ? ` · ${methodLabel(p.method)}` : ""}</span>
                </span>
                <span className="tabular-nums font-medium">{money(p.amount)}</span>
                <button type="button" aria-label="Remove payment" disabled={pending} className="text-muted hover:text-danger disabled:opacity-50" onClick={() => confirm(`Remove this ${money(p.amount)} payment?`) && start(() => deletePayment(p.id))}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <form action={submit} className="px-4 py-3 space-y-3 border-t border-border bg-background/60">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                  <Input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max={balance} defaultValue={balance.toFixed(2)} className="pl-7" required autoFocus />
                </div>
              </Field>
              <Field label="Date">
                <Input name="paidAt" type="date" defaultValue={today} required />
              </Field>
            </div>
            <Select name="method" defaultValue="">{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
            <Input name="note" placeholder="Note (e.g. Progress payment — drywall done)" maxLength={200} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save payment"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
          <span className="text-muted">{balance > 0 ? "Balance due" : "Paid in full"}</span>
          <span className={`tabular-nums font-semibold ${balance > 0 ? "" : "text-success"}`}>{money(balance)}</span>
        </div>
        {payments.length === 0 && !adding && (
          <p className="px-4 pb-3 text-xs text-muted">Nothing received yet. Record the deposit or a progress payment as the money comes in.</p>
        )}
      </CardBody>
    </Card>
  );
}
