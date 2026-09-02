import { NextResponse } from "next/server";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSheetWithDetail } from "@/lib/hours-on-site";
import { generateHoursOnSitePdf, paramsFromSheet } from "@/lib/hours-on-site-pdf";

// Always regenerated from the sheet's current data — see
// generateHoursOnSitePdf's own comment on why this is never a stored file.
export async function GET(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sheet = await getSheetWithDetail(sheetId);
  if (!sheet || sheet.projectId !== projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdfBytes = await generateHoursOnSitePdf(paramsFromSheet(sheet));

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Hours on Site - ${sheet.project.name} - ${sheet.startedAt.toISOString().slice(0, 10)}.pdf"`
    }
  });
}
