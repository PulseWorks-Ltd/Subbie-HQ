import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadToS3 } from "@/lib/s3";

const generateSchema = z.object({
  referenceDate: z.string().datetime(),
  amount: z.number().nonnegative()
});

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

  const payload = generateSchema.parse(await request.json());

  const [latestInvoice, project] = await Promise.all([
    prisma.invoice.findFirst({
      where: { projectId },
      orderBy: { invoiceNumber: "desc" }
    }),
    prisma.project.findUnique({ where: { id: projectId } })
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.invoiceModeEnabled) {
    return NextResponse.json({ error: "Invoice mode disabled" }, { status: 400 });
  }

  const invoiceNumber = (latestInvoice?.invoiceNumber ?? 0) + 1;
  const amount = new Decimal(payload.amount);

  const pdfBytes = await generateInvoicePdf({
    projectName: project.name,
    invoiceNumber,
    referenceDate: new Date(payload.referenceDate),
    amount: `$${amount.toFixed(2)}`
  });

  const pdfKey = `projects/${projectId}/invoices/invoice-${invoiceNumber}.pdf`;
  const { fileUrl, storageKey } = await uploadToS3({
    key: pdfKey,
    body: pdfBytes,
    contentType: "application/pdf"
  });

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      invoiceNumber,
      referenceDate: new Date(payload.referenceDate),
      amount,
      pdfUrl: fileUrl,
      storageKey
    }
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
