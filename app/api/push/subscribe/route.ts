import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = subscriptionSchema.parse(await request.json());

  await prisma.pushSubscription.upsert({
    where: { endpoint: payload.endpoint },
    create: {
      userId,
      endpoint: payload.endpoint,
      p256dhKey: payload.keys.p256dh,
      authKey: payload.keys.auth
    },
    update: {
      userId,
      p256dhKey: payload.keys.p256dh,
      authKey: payload.keys.auth
    }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await request.json());

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });

  return NextResponse.json({ ok: true });
}
