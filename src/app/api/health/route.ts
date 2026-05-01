import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "complaintsignal-backend",
    env: {
      apify: Boolean(process.env.APIFY_API_TOKEN),
      apifyActor: process.env.APIFY_GOOGLE_SEARCH_ACTOR || null,
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      elevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
      elevenLabsVoiceId: Boolean(process.env.ELEVENLABS_VOICE_ID)
    }
  });
}
