import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.AI_MODEL ?? "claude-opus-5";

export const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        type: z.enum(["PRICING", "SCOPE", "TERMS", "WORDING", "UPSELL", "RISK"]),
        title: z.string(),
        detail: z.string(),
        // Optional machine-applicable action, e.g. rewrite a line description
        action: z
          .object({
            kind: z.enum(["REWRITE_LINE", "SET_DEPOSIT", "ADD_LINE", "SET_TERMS"]),
            lineIndex: z.number().nullable(),
            payload: z.string(),
          })
          .nullable(),
      }),
    )
    .max(6),
});

export type AiSuggestions = z.infer<typeof suggestionSchema>;

// Stable text → cacheable prefix. Nothing volatile goes in here.
const SYSTEM = `You are an estimating advisor for a small US contractor. You review a draft estimate
and return a short list of concrete, actionable suggestions. Ground every suggestion in the data
provided (this contractor's own catalog, history and win/loss record) — never invent market prices.
Prioritize: (1) pricing errors or lines far from this contractor's own averages, (2) missing scope
items that are usually paired with the listed work, (3) terms that hurt acceptance (no deposit on
large jobs, no validity date), (4) unprofessional wording. Keep each detail under 60 words, written
in plain English a tradesperson would use. Return at most 6 suggestions; fewer is fine.`;

export async function recommendForEstimate(orgId: string, estimateId: string) {
  const [estimate, catalog, history] = await Promise.all([
    prisma.estimate.findFirstOrThrow({
      where: { id: estimateId, organizationId: orgId },
      include: { lineItems: { orderBy: { position: "asc" } }, client: true, organization: true },
    }),
    prisma.serviceItem.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { usageCount: "desc" },
      take: 60,
    }),
    // last 40 non-draft estimates: what this contractor charges and what gets accepted
    prisma.estimate.findMany({
      where: { organizationId: orgId, id: { not: estimateId }, status: { not: "DRAFT" } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        status: true,
        total: true,
        depositAmount: true,
        clientId: true,
        lineItems: { select: { name: true, quantity: true, unit: true, unitPrice: true } },
      },
    }),
  ]);

  const context = {
    business: {
      name: estimate.organization.name,
      state: estimate.organization.state,
      defaultTaxRate: estimate.organization.defaultTaxRate,
    },
    catalog: catalog.map((s) => ({ name: s.name, unit: s.unit, unitPrice: s.unitPrice, category: s.category })),
    history: history.map((h) => ({
      status: h.status,
      total: h.total,
      deposit: h.depositAmount,
      sameClient: h.clientId === estimate.clientId,
      lines: h.lineItems,
    })),
    estimate: {
      title: estimate.title,
      client: { name: `${estimate.client.firstName} ${estimate.client.lastName ?? ""}`.trim(), notes: estimate.client.notes },
      lines: estimate.lineItems.map((l, i) => ({
        index: i,
        name: l.name,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      subtotal: estimate.subtotal,
      discount: estimate.discountAmount,
      taxRate: estimate.taxRate,
      total: estimate.total,
      deposit: estimate.depositAmount,
      expiresAt: estimate.expiresAt,
      notes: estimate.notes,
      terms: estimate.terms,
    },
  };

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(suggestionSchema) },
    messages: [
      {
        role: "user",
        content: `Review this estimate.\n\n${JSON.stringify(context, null, 0)}`,
      },
    ],
  });

  const parsed = response.parsed_output ?? { suggestions: [] };

  await prisma.aiRecommendation.create({
    data: {
      organizationId: orgId,
      estimateId,
      model: MODEL,
      inputTokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
      suggestions: parsed.suggestions,
    },
  });

  return parsed;
}
