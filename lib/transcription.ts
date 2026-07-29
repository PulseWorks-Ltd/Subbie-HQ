import OpenAI, { toFile } from "openai";

// Separate from lib/grok.ts's client — Grok (xAI) doesn't offer a
// Whisper-equivalent speech-to-text endpoint, so this talks to OpenAI's own
// API directly with its own key. Constructed lazily for the same reason as
// grok.ts's getClient(): avoid crashing Next.js's build-time page-data
// collection if OPENAI_API_KEY isn't set yet.
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
}

// Voice-to-text is a nice-to-have accelerator, not a requirement (see
// components/updates/update-composer.tsx) — returns null rather than
// throwing whenever transcription isn't available or fails, so callers can
// always fall back to letting the user type instead of blocking the flow.
export async function transcribeAudio(buffer: Uint8Array, filename: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const file = await toFile(buffer, filename);
    const response = await client.audio.transcriptions.create({ file, model: "whisper-1" });
    const text = response.text?.trim();
    return text || null;
  } catch (error) {
    console.error("Whisper transcription failed:", error);
    return null;
  }
}
