"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiSuggestions } from "@/lib/ai/recommend";

const typeStyle: Record<string, string> = {
  PRICING: "bg-warning-soft text-warning",
  SCOPE: "bg-accent-soft text-accent",
  TERMS: "bg-black/5 text-muted",
  WORDING: "bg-black/5 text-muted",
  UPSELL: "bg-success-soft text-success",
  RISK: "bg-danger-soft text-danger",
};

export function AiPanel({ estimateId }: { estimateId: string }) {
  const [state, setState] = useState<{ loading: boolean; data?: AiSuggestions; error?: string }>({ loading: false });

  async function run() {
    setState({ loading: true });
    try {
      const res = await fetch("/api/ai/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ estimateId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `Request failed (${res.status})`);
      setState({ loading: false, data: await res.json() });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : "Something went wrong" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> AI review</CardTitle>
        <Button size="sm" variant="secondary" onClick={run} disabled={state.loading}>{state.loading ? "Thinking…" : state.data ? "Run again" : "Review"}</Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {!state.data && !state.error && !state.loading && (
          <p className="text-sm text-muted">Checks pricing against your own history, missing scope items, and terms that hurt acceptance.</p>
        )}
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.data?.suggestions.length === 0 && <p className="text-sm text-muted">Looks good — nothing to flag.</p>}
        {state.data?.suggestions.map((s, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase tracking-wider font-medium rounded px-1.5 py-0.5 ${typeStyle[s.type] ?? ""}`}>{s.type}</span>
              <p className="text-sm font-medium">{s.title}</p>
            </div>
            <p className="text-sm text-muted">{s.detail}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
