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
const STT_ENDPOINT = "https://api.x.ai/v1/stt";

type GrokSttResponse = {
  text?: string;
};

// Voice-to-text is a nice-to-have accelerator, not a requirement (see
// components/updates/update-composer.tsx) — returns null rather than
// throwing whenever transcription isn't available or fails, so callers can
// always fall back to letting the user type instead of blocking the flow.
export async function transcribeAudio(buffer: Uint8Array, filename: string): Promise<string | null> {
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
      console.error(`Grok STT request failed (${response.status}):`, await response.text());
      return null;
    }

    const data = (await response.json()) as GrokSttResponse;
    const text = data.text?.trim();
    return text || null;
  } catch (error) {
    console.error("Grok STT transcription failed:", error);
    return null;
  }
}
