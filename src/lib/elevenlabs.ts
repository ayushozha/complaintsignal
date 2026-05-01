export interface ElevenLabsResult {
  bytes: Uint8Array;
  contentType: string;
  fileExtension: "mp3" | "wav";
}

const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

export class MissingElevenLabsKeyError extends Error {
  constructor() {
    super("ELEVENLABS_API_KEY is not set.");
    this.name = "MissingElevenLabsKeyError";
  }
}

export class MissingElevenLabsVoiceError extends Error {
  constructor() {
    super("ELEVENLABS_VOICE_ID is not set.");
    this.name = "MissingElevenLabsVoiceError";
  }
}

export async function generateElevenLabsAudio(text: string): Promise<ElevenLabsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new MissingElevenLabsKeyError();
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new MissingElevenLabsVoiceError();
  }

  const baseUrl = (process.env.ELEVENLABS_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || DEFAULT_OUTPUT_FORMAT;

  const url = `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: text.slice(0, 4096),
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs request failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";

  if (contentType.includes("wav")) {
    return { bytes, contentType: "audio/wav", fileExtension: "wav" };
  }

  return { bytes, contentType: "audio/mpeg", fileExtension: "mp3" };
}
