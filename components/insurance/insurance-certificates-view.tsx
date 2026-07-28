"use client";

import { useState } from "react";
import type { InsuranceCertificate, InsuranceDistribution, Project } from "@prisma/client";
import { InsuranceCertificateCard } from "@/components/insurance/insurance-certificate-card";
import { InsuranceCertificateFormDialog } from "@/components/insurance/insurance-certificate-form-dialog";

export type InsuranceCertificateRow = InsuranceCertificate & {
  distributions: (InsuranceDistribution & { project: Pick<Project, "id" | "name"> })[];
};

export function InsuranceCertificatesView({
  certificates,
  activeProjectCount,
  isAdmin
}: {
  certificates: InsuranceCertificateRow[];
  activeProjectCount: number;
  isAdmin: boolean;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<InsuranceCertificateRow | null>(null);

  function openCreateDialog() {
    setEditingCertificate(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(certificate: InsuranceCertificateRow) {
    setEditingCertificate(certificate);
    setIsDialogOpen(true);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Insurance</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Certificates your company holds, shared across every project — not tracked per-project.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
          >
            Add Certificate
          </button>
        )}
      </div>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No insurance certificates yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Add your Public Liability, Contract Works, and other policies here — once.
          </p>
          {isAdmin && (
            <button
              onClick={openCreateDialog}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
            >
              Add Certificate
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {certificates.map((certificate) => (
            <InsuranceCertificateCard
              key={certificate.id}
              certificate={certificate}
              activeProjectCount={activeProjectCount}
              isAdmin={isAdmin}
              onEdit={() => openEditDialog(certificate)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <InsuranceCertificateFormDialog
          certificate={editingCertificate}
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  );
}
