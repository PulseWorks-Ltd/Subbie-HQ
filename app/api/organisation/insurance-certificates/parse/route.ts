import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { uploadToS3 } from "@/lib/s3";
import { extractPdfPagesWithOcrFallback, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractInsuranceCertificateFromText } from "@/lib/grok";

// Uploads the certificate and extracts fields as an unsaved preview — the
// user reviews/corrects the pre-filled form before anything is actually
// created (see the sibling POST route). Certificates are typically only a
// few pages, so — unlike Contract/Programme uploads — this stays fully
// synchronous rather than a background job, matching the Variation/Site
// Instruction parse route's pattern.
export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files can be parsed automatically." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `organisations/${admin.organisationId}/insurance-certificates/${Date.now()}-${file.name}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

  let extracted;
  try {
    const pages = await extractPdfPagesWithOcrFallback(buffer);
    const text = pages.map((p) => p.text).join("\n\n");
    extracted = await extractInsuranceCertificateFromText(text, { organisationId: admin.organisationId, userId });
  } catch (error) {
    const message =
      error instanceof UnreadablePdfError
        ? "This PDF's text couldn't be read automatically, even with OCR. Please fill the details in manually."
        : "Could not read this document automatically. You can still fill the details in manually.";
    return NextResponse.json({ error: message, fileName: file.name, storageKey }, { status: 422 });
  }

  return NextResponse.json({ extracted, fileName: file.name, storageKey });
}
