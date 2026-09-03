import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { prisma } from "./prisma";
import { downloadFromS3 } from "./s3";

// Shared across every PDF this app generates (Hours on Site, Variation
// Package, Payment Claim) — one place that knows how to fetch an
// organisation's logo (set on Settings → Organisation) and stamp it onto
// a page, so each generator's own layout code just asks for a PDFImage
// and draws it wherever fits that document's own header.

export type OrgLogo = { bytes: Uint8Array; contentType: string } | null;

// Looked up fresh per generation — never cached across calls, since an
// org could change its logo between two PDFs and a stale embed would be
// a confusing, silent bug. Returns null (not a placeholder box) when
// there's no logo set, or if the stored file can't be fetched — a logo
// hiccup must never be the reason a real PDF fails to generate.
export async function getOrganisationLogo(organisationId: string | null | undefined): Promise<OrgLogo> {
  if (!organisationId) return null;
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { logoStorageKey: true, logoContentType: true }
  });
  if (!org?.logoStorageKey || !org.logoContentType) return null;

  try {
    const bytes = await downloadFromS3(org.logoStorageKey);
    return { bytes, contentType: org.logoContentType };
  } catch {
    return null;
  }
}

// Embedding is per-PDFDocument in pdf-lib, so this takes the doc the
// caller already created and hands back a PDFImage it draws itself —
// every generator in this app lays out its own header differently.
export async function embedOrganisationLogo(doc: PDFDocument, logo: OrgLogo): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    return logo.contentType === "image/png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
  } catch {
    return null;
  }
}

// The one shared "logo in the corner" convention — scaled to fit inside a
// fixed box without distorting its aspect ratio. (x, y) is the box's
// top-left corner; pdf-lib's own coordinate origin is bottom-left, so this
// does the top-left-anchored math once rather than every call site
// re-deriving it.
export function drawLogo(
  page: PDFPage,
  image: PDFImage,
  opts: { x: number; y: number; maxWidth: number; maxHeight: number }
): { width: number; height: number } {
  const scale = Math.min(opts.maxWidth / image.width, opts.maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: opts.x, y: opts.y - height, width, height });
  return { width, height };
}
