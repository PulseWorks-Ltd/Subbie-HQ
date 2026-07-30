// Voice-to-text for the Updates composer, via Grok's (xAI) Speech-to-Text
// REST API — reuses the same XAI_API_KEY as every other Grok call in this
// app (see lib/grok.ts), rather than a separate OpenAI/Whisper account.
// https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
//
// `file` must be the LAST field appended to the multipart form (xAI
// requirement — earlier fields are read as form parameters before the
// file stream starts). WebM/Opus (Chrome/Android MediaRecorder's default
// output) and MP4/AAC (Safari/iOS's default) are both natively supported
// container formats, so the client-side recording code needs no changes.
import { recordAiUsageSuccess, recordAiUsageFailure } from "./ai-usage";

const STT_ENDPOINT = "https://api.x.ai/v1/stt";
const STT_MODEL_LABEL = "grok-stt";

type GrokSttResponse = {
  text?: string;
};

// Voice-to-text is a nice-to-have accelerator, not a requirement (see
// components/updates/update-composer.tsx) — returns null rather than
// throwing whenever transcription isn't available or fails, so callers can
// always fall back to letting the user type instead of blocking the flow.
// Logged separately from lib/grok.ts's callGrok wrapper (not through it) —
// this hits xAI's STT REST endpoint directly via fetch, not the OpenAI SDK
// chat-completions client, and its response carries no token-usage figures
// to cost against, only a plain success/failure outcome.
export async function transcribeAudio(
  buffer: Uint8Array,
  filename: string,
  usageContext: { organisationId: string | null; userId: string | null; contextRef?: string | null }
): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.set("language", "en");
    formData.set("format", "true");
    // file must be appended last, per xAI's multipart field ordering requirement.
    formData.set("file", new Blob([Buffer.from(buffer)]), filename);

    const response = await fetch(STT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`Grok STT request failed (${response.status}):`, responseText);
      await recordAiUsageFailure({
        context: { feature: "voice_transcription", ...usageContext },
        model: STT_MODEL_LABEL,
        error: new Error(`STT request failed (${response.status}): ${responseText.slice(0, 200)}`)
      });
      return null;
    }

    const data = (await response.json()) as GrokSttResponse;
    const text = data.text?.trim();
    await recordAiUsageSuccess({
      context: { feature: "voice_transcription", ...usageContext },
      model: STT_MODEL_LABEL,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null
    });
    return text || null;
  } catch (error) {
    console.error("Grok STT transcription failed:", error);
    await recordAiUsageFailure({
      context: { feature: "voice_transcription", ...usageContext },
      model: STT_MODEL_LABEL,
      error
    });
    return null;
  }
}
