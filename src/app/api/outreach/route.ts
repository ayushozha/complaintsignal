import { NextResponse } from "next/server";
import { z } from "zod";
import { findLead } from "@/lib/lead-service";
import { jsonError } from "@/lib/http";
import { generateOutreachPack } from "@/lib/outreach";
import { loadSeedDataset } from "@/lib/seed-store";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OutreachRequest = z.object({
  leadId: z.string().optional(),
  lead: z.custom<Lead>().optional()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = OutreachRequest.safeParse(body);

  if (!parsed.success) {
    return jsonError("Expected JSON body with leadId or lead.", 400, "invalid_body");
  }

  const lead = parsed.data.lead ?? (await loadLeadById(parsed.data.leadId));

  if (!lead) {
    return jsonError("Lead not found. Generate /api/leads first.", 404, "lead_not_found");
  }

  const result = await generateOutreachPack(lead);

  return NextResponse.json(result);
}

async function loadLeadById(leadId: string | undefined): Promise<Lead | null> {
  if (!leadId) {
    return null;
  }

  const dataset = await loadSeedDataset();
  if (!dataset) {
    return null;
  }

  return findLead(dataset, leadId) ?? null;
}
