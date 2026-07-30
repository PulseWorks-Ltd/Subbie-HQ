import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { transcribeAudio } from "@/lib/transcription";
import { prisma } from "@/lib/prisma";
import { AiSpendCapExceededError } from "@/lib/ai-usage";

// Pure utility endpoint — transcribes a recorded voice note into text for
// the update composer to pre-fill (see components/updates/update-composer.tsx).
// Nothing is persisted here; the user reviews/edits the returned text before
// it's ever submitted as part of an actual update.
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!audio || !(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }

  const buffer = new Uint8Array(await audio.arrayBuffer());
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });

  let text: string | null;
  try {
    text = await transcribeAudio(buffer, audio.name || "recording.webm", {
      organisationId: project?.organisationId ?? null,
      userId
    });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

  if (text === null) {
    return NextResponse.json(
      { error: "Could not transcribe this recording. You can type the update instead." },
      { status: 422 }
    );
  }

  return NextResponse.json({ text });
}
