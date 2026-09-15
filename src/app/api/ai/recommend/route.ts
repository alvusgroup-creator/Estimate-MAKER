import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/auth";
import { recommendForEstimate } from "@/lib/ai/recommend";

const bodySchema = z.object({ estimateId: z.string().min(1) });

export async function POST(req: Request) {
  const { orgId } = await requireOrg();

  const body = bodySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "estimateId required" }, { status: 400 });

  const result = await recommendForEstimate(orgId, body.data.estimateId);
  return NextResponse.json(result);
}
