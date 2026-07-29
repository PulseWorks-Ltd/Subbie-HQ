import { prisma } from "./prisma";
import { normalizeCoverType } from "./insurance-cover-types";

export type CoverComparisonStatus = "sufficient" | "insufficient" | "missing";

export type CoverComparisonRow = {
  coverType: string;
  requiredValue: number;
  heldValue: number | null;
  status: CoverComparisonStatus;
};

// Live comparison, computed fresh on every call — never a stored snapshot,
// so a certificate renewal (new value) is reflected immediately without
// needing the contract to be re-reviewed (see ContractRequiredCover's
// comment in prisma/schema.prisma). Held value is the highest single
// InsuranceCertificateCover found for that type across all of the
// organisation's certificates — not summed across certificates.
export async function getCoverComparisonForProject(projectId: string): Promise<CoverComparisonRow[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return [];

  const required = await prisma.contractRequiredCover.findMany({ where: { projectId } });
  if (required.length === 0) return [];

  const heldCovers = await prisma.insuranceCertificateCover.findMany({
    where: { insuranceCertificate: { organisationId: project.organisationId } },
    select: { coverType: true, value: true }
  });

  return required.map((req) => {
    const matching = heldCovers.filter((h) => normalizeCoverType(h.coverType) === normalizeCoverType(req.coverType));
    const heldValue = matching.length ? Math.max(...matching.map((m) => Number(m.value))) : null;
    const requiredValue = Number(req.requiredValue);
    const status: CoverComparisonStatus = heldValue === null ? "missing" : heldValue >= requiredValue ? "sufficient" : "insufficient";
    return { coverType: req.coverType, requiredValue, heldValue, status };
  });
}
