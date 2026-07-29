import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { extractVariationItemFromText } from "@/lib/grok";
import { extractPdfPagesWithOcrFallback, UnreadablePdfError } from "@/lib/pdf-text-extraction";

function moduleForType(type: "variation" | "site_instruction") {
  return type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const typeRaw = formData.get("type");
  const type = typeRaw === "variation" ? "variation" : "site_instruction";

  const canAccessModule = await requireModuleAccess(projectId, userId, moduleForType(type));
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files can be parsed automatically." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/variation-items/${Date.now()}-${file.name}`;

  const { storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type
  });

  let extracted;
  try {
    // Falls back to OCR automatically if the PDF's text layer looks
    // unreadable (e.g. a broken font ToUnicode mapping from certain
    // "print to PDF" pipelines). These documents are typically only a few
    // pages, so this stays synchronous rather than backgrounded.
    const pages = await extractPdfPagesWithOcrFallback(buffer);
    const text = pages.map((p) => p.text).join("\n\n");

    extracted = await extractVariationItemFromText(text, type);
  } catch (error) {
    const message =
      error instanceof UnreadablePdfError
        ? "This PDF's text couldn't be read automatically, even with OCR — this usually happens with documents produced by certain \"print to PDF\" tools. Please try re-exporting it, or fill the details in manually."
        : "Could not read this document automatically. You can still fill the details in manually.";
    return NextResponse.json({ error: message, fileName: file.name, storageKey }, { status: 422 });
  }

  return NextResponse.json({ extracted, fileName: file.name, storageKey });
}
