// Shared limits/types for Update attachments — imported by both the
// client composer/reply forms (for immediate feedback before upload) and
// the server route (the actual enforcement; client-side checks are only
// a courtesy). Keeping this in one place means the limit a user sees in
// the UI can never drift from the limit the server actually applies.

// Chosen deliberately, not left unbounded: 10 files keeps a single update
// scannable in the thread view; 20MB comfortably covers a phone-camera
// photo or a scanned multi-page PDF/DOCX without risking a very slow
// upload on-site.
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

// Passed directly as an <input accept> value by every composer/reply form.
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(",");

export function isAllowedAttachmentType(contentType: string): boolean {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(contentType);
}

export type AttachmentKind = "image" | "pdf" | "docx" | "other";

export function attachmentKind(contentType: string | null | undefined): AttachmentKind {
  if (!contentType) return "other";
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "other";
}

// The Day Works vision-extraction pipeline (see the day-works-sheets
// sheet-records/extract route) only reads images and PDFs — DOCX isn't
// built to be read there, so "Use as Day Works Sheet" shouldn't be
// offered on a DOCX attachment at all (Task 4.2).
export function canUseAsDayWorksSheet(contentType: string | null | undefined): boolean {
  const kind = attachmentKind(contentType);
  return kind === "image" || kind === "pdf";
}
