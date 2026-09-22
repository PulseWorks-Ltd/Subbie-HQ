import { NextResponse } from "next/server";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { transcribeAudio } from "@/lib/transcription";
import { prisma } from "@/lib/prisma";
import { AiSpendCapExceededError } from "@/lib/ai-usage";

// Pure utility endpoint, same shape as .../updates/transcribe — transcribes
// a recorded voice note into text for the Hours on Site "Comments" field
// (components/mobile/hours-on-site-project-view.tsx) to pre-fill, so a
// worker can describe what they're about to do without typing on a phone
// keyboard. Nothing is persisted here; the text lands in the form field
// for the worker to review/edit before Start is actually pressed. Gated
// by plain project access only, matching Hours on Site's own existing
// routes (no dedicated permission module — same convention as Tasks).
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
      { error: "Could not transcribe this recording. You can type the description instead." },
      { status: 422 }
    );
  }

  return NextResponse.json({ text });
}
