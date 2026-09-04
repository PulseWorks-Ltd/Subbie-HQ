// Shared limit for a QARecord's own attachments — same shape as
// lib/update-attachments.ts's MAX_ATTACHMENTS (imported by both the client
// form for immediate feedback and the server route for actual
// enforcement, so the two can never drift). No such cap existed before
// this — QA record creation was previously uncapped.
//
// 12 rather than Update's 10 — a QA record often IS the whole evidence
// set for one inspection stage (e.g. every rebar tie photographed before
// pour), so it reasonably needs a little more headroom than a single
// diary entry.
export const MAX_QA_ATTACHMENTS = 12;
