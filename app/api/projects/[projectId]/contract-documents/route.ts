import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.contractDocument.findMany({
    where: { projectId },
    orderBy: { uploadedAt: "desc" }
  });

  return NextResponse.json({ documents });
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
  const title = formData.get("title")?.toString() ?? "Contract Document";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/contracts/${Date.now()}-${file.name}`;

  const { fileUrl, storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type || "application/pdf"
  });

  const document = await prisma.contractDocument.create({
    data: {
      projectId,
      title,
      fileName: file.name,
      fileUrl,
      storageKey,
      status: "draft"
    }
  });

  // TODO: Trigger contract parsing pipeline and populate Clause records.

  return NextResponse.json({ document }, { status: 201 });
}
