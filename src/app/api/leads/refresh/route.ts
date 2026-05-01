import { NextResponse } from "next/server";
import { buildLeadDataset } from "@/lib/lead-service";
import { saveSeedDataset } from "@/lib/seed-store";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.REFRESH_TOKEN;
  if (token && request.headers.get("x-refresh-token") !== token) {
    return jsonError("Invalid refresh token.", 401, "unauthorized");
  }

  const dataset = await buildLeadDataset();
  const path = await saveSeedDataset(dataset);

  return NextResponse.json({
    source: "live",
    savedTo: path,
    ...dataset
  });
}
