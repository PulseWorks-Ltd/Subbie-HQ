import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { extractSiteInstructionFromText } from "@/lib/grok";

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

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files can be parsed automatically." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/site-instructions/${Date.now()}-${file.name}`;

  const { storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type
  });

  let extracted;
  try {
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    if (!text.trim()) {
      throw new Error("No extractable text in PDF.");
    }

    extracted = await extractSiteInstructionFromText(text);
  } catch {
    return NextResponse.json(
      {
        error: "Could not read this document automatically. You can still fill the details in manually.",
        fileName: file.name,
        storageKey
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ extracted, fileName: file.name, storageKey });
}
