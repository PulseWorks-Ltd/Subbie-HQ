import { z } from "zod";

export const StandardFormClauseSchema = z.object({
  clauseRef: z.string(),
  part: z.string(),
  section: z.string(),
  topicBucket: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  pageNumber: z.number().int().nullable(),
  isFillIn: z.boolean()
});

export const StandardFormSchema = z.object({
  version: z.string(),
  sourceTitle: z.string(),
  generatedAt: z.string(),
  clauses: z.array(StandardFormClauseSchema)
});

export type StandardFormClause = z.infer<typeof StandardFormClauseSchema>;
export type StandardForm = z.infer<typeof StandardFormSchema>;
