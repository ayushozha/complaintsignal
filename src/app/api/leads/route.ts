import { NextResponse } from "next/server";
import { buildLeadDataset } from "@/lib/lead-service";
import { loadSeedDataset } from "@/lib/seed-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true";

  if (!refresh) {
    const seed = await loadSeedDataset();
    if (seed) {
      return NextResponse.json({
        source: "seed",
        ...seed
      });
    }
  }

  const dataset = await buildLeadDataset();

  return NextResponse.json({
    source: "live",
    ...dataset
  });
}
