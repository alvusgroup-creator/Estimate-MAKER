"use client";

import { useState } from "react";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiReview } from "@/lib/ai/recommend";
import { rateRecommendation } from "@/lib/ai/actions";

const typeStyle: Record<string, string> = {
  PRICING: "bg-warning-soft text-warning",
  SCOPE: "bg-accent-soft text-accent",
  TERMS: "bg-black/5 text-muted",
  WORDING: "bg-black/5 text-muted",
  UPSELL: "bg-success-soft text-success",
  RISK: "bg-danger-soft text-danger",
};

export function AiPanel({ estimateId }: { estimateId: string }) {
  const [state, setState] = useState<{ loading: boolean; data?: AiReview; error?: string }>({ loading: false });
  const [rating, setRating] = useState<1 | -1 | null>(null);

  async function run() {
    setState({ loading: true });
    setRating(null);
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
        {state.data && state.data.suggestions.length > 0 && (
          <div className="flex items-center justify-end gap-1 pt-1 text-xs text-muted">
            <span className="mr-1">{rating ? "Thanks for the feedback" : "Was this useful?"}</span>
            {([1, -1] as const).map((v) => {
              const Icon = v === 1 ? ThumbsUp : ThumbsDown;
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={v === 1 ? "Useful" : "Not useful"}
                  aria-pressed={rating === v}
                  disabled={rating !== null}
                  onClick={() => {
                    setRating(v);
                    void rateRecommendation(state.data!.recommendationId, v);
                  }}
                  className={`rounded-md p-1.5 transition-colors hover:bg-black/5 disabled:hover:bg-transparent ${rating === v ? "text-accent" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
