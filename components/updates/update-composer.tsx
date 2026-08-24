"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationItem } from "@prisma/client";
import { AttachmentPreviewList } from "@/components/updates/attachment-preview-list";
import { AssignUpdateAsQaDialog } from "@/components/quality-assurance/assign-update-as-qa-dialog";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";
import { ASSIGN_QA_SENTINEL } from "@/lib/qa-tag";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type Recipient = { contactId?: string; email: string; label: string };

export function UpdateComposer({
  projectId,
  taggableItems,
  contacts,
  variant
}: {
  projectId: string;
  taggableItems: VariationItem[];
  contacts: ContactOption[];
  variant: "mobile" | "desktop";
}) {
  const router = useRouter();
  const isMobile = variant === "mobile";

  const [body, setBody] = useState("");
  const [variationItemId, setVariationItemId] = useState("");
  const [percentComplete, setPercentComplete] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExternal, setIsExternal] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [drafted, setDrafted] = useState<{ subject: string; body: string } | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Set right after posting, when "Assign QA" was chosen — opens the same
  // dialog used for post-hoc "Assign QA" (components/quality-assurance/
  // assign-update-as-qa-dialog.tsx), pre-filled with the update this
  // composer just created (its id + body), since a QARecord needs a stage
  // label the composer itself doesn't ask for inline.
  const [pendingQaAssignment, setPendingQaAssignment] = useState<{ updateId: string; body: string } | null>(null);

  const openItems = taggableItems.filter((item) => item.status !== "complete");
  const eligibleContacts = contacts.filter((contact) => contact.email);

  // Two separate <input> elements can both feed this same list (mobile's
  // camera capture and its file/document picker, Task 2.2) — selecting
  // from either ADDS to whatever's already picked rather than replacing
  // it, so using one doesn't wipe out a selection already made with the
  // other. Invalid files (wrong type, or over MAX_ATTACHMENT_SIZE_BYTES)
  // are rejected client-side with a message rather than silently dropped
  // or left for the server to reject after a full upload attempt.
  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setError(null);
    const incoming = Array.from(selected);

    const invalidType = incoming.find((file) => !isAllowedAttachmentType(file.type));
    if (invalidType) {
      setError(`"${invalidType.name}" isn't a supported file type. Attach images, PDFs, or DOCX files.`);
      return;
    }
    const tooLarge = incoming.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (tooLarge) {
      setError(`"${tooLarge.name}" is over the ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB limit per attachment.`);
      return;
    }

    setFiles((current) => {
      const combined = [...current, ...incoming];
      if (combined.length > MAX_ATTACHMENTS) {
        setError(`You can attach up to ${MAX_ATTACHMENTS} files per update.`);
        return current;
      }
      return combined;
    });
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function toggleContactRecipient(contact: ContactOption) {
    setRecipients((current) => {
      const exists = current.some((r) => r.contactId === contact.id);
      if (exists) return current.filter((r) => r.contactId !== contact.id);
      return [...current, { contactId: contact.id, email: contact.email!, label: contact.name }];
    });
  }

  function addOneOffEmail() {
    const email = oneOffEmail.trim();
    if (!email || !email.includes("@")) return;
    if (recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      setOneOffEmail("");
      return;
    }
    setRecipients((current) => [...current, { email, label: email }]);
    setOneOffEmail("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) => current.filter((r) => r.email !== email));
  }

  function resetExternalState() {
    setIsExternal(false);
    setRecipients([]);
    setOneOffEmail("");
    setDrafted(null);
    setDraftError(null);
  }

  async function handleDraft() {
    if (!body.trim()) return;
    setIsDrafting(true);
    setDraftError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/updates/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachmentCount: files.length })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not draft an email.");
      }
      const data = await response.json();
      setDrafted(data.drafted);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not draft an email.");
    } finally {
      setIsDrafting(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setTranscribeError(null);
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
          const response = await fetch(`/api/projects/${projectId}/updates/transcribe`, { method: "POST", body: formData });
          const data = await response.json();
          if (!response.ok) {
            setTranscribeError(data.error || "Could not transcribe this recording. You can type instead.");
            return;
          }
          setBody((current) => (current.trim() ? `${current.trim()}\n\n${data.text}` : data.text));
        } catch {
          setTranscribeError("Could not transcribe this recording. You can type instead.");
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setTranscribeError("Couldn't access the microphone. You can type instead.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    if (isExternal && (!drafted || recipients.length === 0)) return;
    setIsSubmitting(true);
    setError(null);

    const isAssigningQa = variationItemId === ASSIGN_QA_SENTINEL;

    const formData = new FormData();
    formData.set("body", body);
    if (variationItemId && !isAssigningQa) formData.set("variationItemId", variationItemId);
    if (!isMobile && variationItemId && !isAssigningQa && percentComplete) formData.set("percentComplete", percentComplete);
    files.forEach((file) => formData.append("files", file));
    if (isExternal && drafted) {
      formData.set("isExternal", "true");
      formData.set("externalSubject", drafted.subject);
      formData.set("externalBody", drafted.body);
      formData.set("recipients", JSON.stringify(recipients.map((r) => ({ contactId: r.contactId, email: r.email }))));
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/updates`, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not post this update.");
        return;
      }
      if (data.sendError) {
        setError(`Update posted, but the email failed to send: ${data.sendError} You can retry from the update.`);
      }
      if (isAssigningQa && data.update?.id) {
        setPendingQaAssignment({ updateId: data.update.id, body: data.update.body ?? body });
      }
      setBody("");
      setVariationItemId("");
      setPercentComplete("");
      setFiles([]);
      resetExternalState();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = body.trim().length > 0 && !isSubmitting && (!isExternal || (drafted !== null && recipients.length > 0));

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={
        isMobile
          ? "bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex flex-col gap-3"
          : "bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3"
      }
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder={isMobile ? "Post a progress update..." : "Post an update for the team..."}
        className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <div className="flex items-center gap-3 flex-wrap">
        {isMobile && (
          <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
            <span className="material-symbols-outlined text-lg">photo_camera</span>
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
              className="hidden"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
          <span className="material-symbols-outlined text-lg">attach_file</span>
          {isMobile ? "Attach files" : "Attach photos, PDFs, or DOCX"}
          <input
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <span className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
            {files.length} file{files.length > 1 ? "s" : ""} attached
          </span>
        )}

        <button
          type="button"
          onClick={toggleRecording}
          disabled={isTranscribing}
          className={`flex items-center gap-1 text-xs font-medium disabled:opacity-60 ${
            isRecording ? "text-red-600 dark:text-red-400" : "text-[#4c739a] dark:text-slate-400"
          }`}
        >
          <span className="material-symbols-outlined text-lg">{isRecording ? "stop_circle" : "mic"}</span>
          {isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Record voice note"}
        </button>
      </div>

      <AttachmentPreviewList files={files} onRemove={removeFile} />

      {transcribeError && <p className="text-xs text-red-600 dark:text-red-400">{transcribeError}</p>}

      {openItems.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={variationItemId}
            onChange={(event) => setVariationItemId(event.target.value)}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not Assigned</option>
            <option value={ASSIGN_QA_SENTINEL}>Assign QA</option>
            {openItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference} · {item.title}
              </option>
            ))}
          </select>
          {!isMobile && variationItemId && variationItemId !== ASSIGN_QA_SENTINEL && (
            <input
              type="number"
              min={0}
              max={100}
              value={percentComplete}
              onChange={(event) => setPercentComplete(event.target.value)}
              placeholder="% complete"
              className="h-9 w-28 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={isExternal}
          onChange={(event) => (event.target.checked ? setIsExternal(true) : resetExternalState())}
        />
        Send this externally by email (e.g. to the Main Contractor)
      </label>

      {isExternal && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3">
          <div>
            <p className="text-xs font-bold mb-1">Recipients</p>
            {eligibleContacts.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {eligibleContacts.map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={recipients.some((r) => r.contactId === contact.id)}
                      onChange={() => toggleContactRecipient(contact)}
                    />
                    {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={oneOffEmail}
                onChange={(event) => setOneOffEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addOneOffEmail();
                  }
                }}
                placeholder="Add a one-off email address"
                className="h-8 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={addOneOffEmail}
                className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium"
              >
                Add
              </button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {recipients.map((recipient) => (
                  <span
                    key={recipient.email}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] px-2 py-1"
                  >
                    {recipient.label}
                    <button type="button" onClick={() => removeRecipient(recipient.email)} className="font-bold">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {!drafted ? (
            <button
              type="button"
              onClick={handleDraft}
              disabled={isDrafting || !body.trim()}
              className="h-9 rounded-lg border border-primary text-primary text-xs font-bold disabled:opacity-60"
            >
              {isDrafting ? "Drafting..." : "Draft email with AI"}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold">Review before sending</p>
              <input
                value={drafted.subject}
                onChange={(event) => setDrafted({ ...drafted, subject: event.target.value })}
                className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={drafted.body}
                onChange={(event) => setDrafted({ ...drafted, body: event.target.value })}
                rows={6}
                className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button type="button" onClick={() => setDrafted(null)} className="self-start text-xs text-[#4c739a] dark:text-slate-400 underline">
                Redo draft
              </button>
            </div>
          )}
          {draftError && <p className="text-xs text-red-600 dark:text-red-400">{draftError}</p>}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className={
          isMobile
            ? "h-11 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            : "self-end h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        }
      >
        {isSubmitting ? "Posting..." : isExternal ? "Send external update" : "Post Update"}
      </button>
    </form>
    {pendingQaAssignment && (
      <AssignUpdateAsQaDialog
        projectId={projectId}
        updateId={pendingQaAssignment.updateId}
        updateBody={pendingQaAssignment.body}
        taggableItems={openItems}
        defaultVariationItemId={null}
        onClose={() => setPendingQaAssignment(null)}
        onAssigned={() => setPendingQaAssignment(null)}
      />
    )}
    </>
  );
}
