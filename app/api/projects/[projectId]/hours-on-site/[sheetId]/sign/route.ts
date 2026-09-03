import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { HoursOnSiteApprovedError, HoursOnSiteNotReadyError, signSheetOnDevice } from "@/lib/hours-on-site";

const signSchema = z.object({
  name: z.string().min(1),
  // A canvas signature pad's toDataURL() output — "data:image/png;base64,...".
  // Decoded server-side rather than trusting a client-supplied content type.
  signatureDataUrl: z.string().startsWith("data:image/png;base64,")
});

// On-device signing — the creator hands their phone/tablet straight to
// the Site Manager/foreman to sign there and then, in person, rather than
// sending a secure link by email (see .../external-actions for that other
// route, still available alongside this one). Same project-access gate as
// every other Hours on Site route — no separate module, see those routes'
// own comments on why.
export async function POST(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.hoursOnSiteSheet.findFirst({ where: { id: sheetId, projectId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = signSchema.parse(await request.json());
  const base64 = payload.signatureDataUrl.slice("data:image/png;base64,".length);
  if (!base64) {
    return NextResponse.json({ error: "The signature looks empty — please sign again." }, { status: 400 });
  }
  const signatureImageBytes = new Uint8Array(Buffer.from(base64, "base64"));

  try {
    const sheet = await signSheetOnDevice(sheetId, {
      name: payload.name,
      signatureImageBytes,
      contentType: "image/png"
    });
    return NextResponse.json({ sheet });
  } catch (error) {
    if (error instanceof HoursOnSiteApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof HoursOnSiteNotReadyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
