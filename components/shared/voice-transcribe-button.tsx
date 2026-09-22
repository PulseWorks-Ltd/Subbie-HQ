"use client";

import { useRef, useState } from "react";

// Reuses the exact same record -> upload -> transcribe flow as the
// Updates composer (components/updates/update-composer.tsx), extracted
// here since Hours on Site now needs it too — same MediaRecorder handling
// (WebM/Opus on Chrome/Android, MP4/AAC on Safari/iOS, both natively
// supported by lib/transcription.ts's Grok STT call), same "never blocks
// the flow" philosophy: any failure just shows a message and lets the
// user type instead.
export function VoiceTranscribeButton({
  endpoint,
  onTranscribed,
  label = "Speak instead"
}: {
  // The route to POST the recorded audio to — a project-scoped "pure
  // utility" endpoint that transcribes and returns { text }, persisting
  // nothing itself (see app/api/projects/[projectId]/hours-on-site/transcribe/route.ts).
  endpoint: string;
  onTranscribed: (text: string) => void;
  label?: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.set("audio", audioBlob, "recording.webm");
          const response = await fetch(endpoint, { method: "POST", body: formData });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setError(typeof data.error === "string" ? data.error : "Could not transcribe this recording. You can type instead.");
            return;
          }
          onTranscribed(data.text as string);
        } catch {
          setError("Could not transcribe this recording. You can type instead.");
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Couldn't access the microphone. You can type instead.");
    }
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={isTranscribing}
        className={`h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 ${
          isRecording
            ? "border-red-300 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
            : "border-[#e7edf3] dark:border-slate-700 text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-base">{isRecording ? "stop_circle" : "mic"}</span>
        {isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : label}
      </button>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
