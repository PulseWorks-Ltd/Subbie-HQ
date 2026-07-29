// Common cover-type presets — offered as quick-select options, but the
// underlying field (InsuranceCertificateCover.coverType /
// ContractRequiredCover.coverType) is plain free text, same
// light-enum-plus-custom pattern as MainContractorContact.role. Matching
// between required and held cover (lib/insurance-cover-comparison.ts) is
// case-insensitive/trimmed string equality against this same shared list,
// so extraction on both sides should prefer these exact labels when the
// document's wording clearly corresponds to one.
export const INSURANCE_COVER_TYPE_PRESETS = [
  "Public Liability",
  "Professional Indemnity",
  "Contract Works",
  "Employers Liability"
] as const;

export function normalizeCoverType(coverType: string): string {
  return coverType.trim().toLowerCase();
}
