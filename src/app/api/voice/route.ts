import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import {
  generateElevenLabsAudio,
  MissingElevenLabsKeyError,
  MissingElevenLabsVoiceError
} from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VoiceRequest = z.object({
  text: z.string().min(1).max(4096),
  filename: z.string().optional()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = VoiceRequest.safeParse(body);

  if (!parsed.success) {
    return jsonError("Expected JSON body with text.", 400, "invalid_body");
  }

  try {
    const audio = await generateElevenLabsAudio(parsed.data.text);
    const filename = parsed.data.filename ?? `callbook-pitch.${audio.fileExtension}`;
    const out = new ArrayBuffer(audio.bytes.byteLength);
    new Uint8Array(out).set(audio.bytes);

    return new Response(out, {
      status: 200,
      headers: {
        "Content-Type": audio.contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof MissingElevenLabsKeyError) {
      return NextResponse.json(
        {
          fallback: "browser_speech",
          error: {
            code: "missing_elevenlabs_api_key",
            message: "ELEVENLABS_API_KEY is not set."
          }
        },
        { status: 200 }
      );
    }

    if (error instanceof MissingElevenLabsVoiceError) {
      return NextResponse.json(
        {
          fallback: "browser_speech",
          error: {
            code: "missing_elevenlabs_voice_id",
            message: "ELEVENLABS_VOICE_ID is not set."
          }
        },
        { status: 200 }
      );
    }

    throw error;
  }
}
