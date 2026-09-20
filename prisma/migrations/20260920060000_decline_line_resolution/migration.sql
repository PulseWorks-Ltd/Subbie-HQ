-- CreateEnum
CREATE TYPE "PaymentReconciliationDeclineLineResolution" AS ENUM ('open', 'carried_forward', 'credited', 'evidence_provided', 'resolved_other');

-- AlterTable
ALTER TABLE "PaymentReconciliationDeclineLine" ADD COLUMN     "resolution" "PaymentReconciliationDeclineLineResolution" NOT NULL DEFAULT 'open',
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByUserId" TEXT,
ADD COLUMN     "resolvedInClaimId" TEXT;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationDeclineLine" ADD CONSTRAINT "PaymentReconciliationDeclineLine_resolvedInClaimId_fkey" FOREIGN KEY ("resolvedInClaimId") REFERENCES "PaymentClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationDeclineLine" ADD CONSTRAINT "PaymentReconciliationDeclineLine_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

