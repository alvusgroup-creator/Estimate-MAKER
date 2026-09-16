"use server";

import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 👍 / 👎 on an AI review. Stored per run (not per suggestion) so we can compare prompts later. */
export async function rateRecommendation(recommendationId: string, feedback: 1 | -1): Promise<{ ok: boolean }> {
  const { orgId } = await requireOrg();
  const { count } = await prisma.aiRecommendation.updateMany({
    where: { id: recommendationId, organizationId: orgId },
    data: { feedback },
  });
  return { ok: count === 1 };
}
