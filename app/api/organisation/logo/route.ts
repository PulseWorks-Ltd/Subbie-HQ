import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { uploadToS3 } from "@/lib/s3";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB — a logo, not a photo; keeps every PDF generation's download fast
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

// Org-wide branding stamped onto every generated PDF — see
// lib/pdf-branding.ts. Admin-only, same gate as the rest of the
// Organisation settings tab (PATCH /api/organisation).
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
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a logo image to upload." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Logo must be a PNG or JPEG image." }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2MB." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const extension = file.type === "image/png" ? "png" : "jpg";
  const uploadKey = `organisations/${admin.organisationId}/logo-${Date.now()}.${extension}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

  await prisma.organisation.update({
    where: { id: admin.organisationId },
    data: { logoStorageKey: storageKey, logoContentType: file.type }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.organisation.update({
    where: { id: admin.organisationId },
    data: { logoStorageKey: null, logoContentType: null }
  });

  return NextResponse.json({ ok: true });
}
