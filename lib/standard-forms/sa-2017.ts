import sa2017Data from "./sa-2017.json";
import { StandardFormSchema, type StandardForm, type StandardFormClause } from "./types";

let cached: StandardForm | null = null;

export function getStandardForm(): StandardForm {
  if (!cached) {
    cached = StandardFormSchema.parse(sa2017Data);
  }
  return cached;
}

export function getStandardFormBuckets(): string[] {
  const buckets = new Set<string>();
  for (const clause of getStandardForm().clauses) {
    buckets.add(clause.topicBucket);
  }
  return Array.from(buckets);
}

export function getStandardFormClausesByBucket(bucket: string): StandardFormClause[] {
  return getStandardForm().clauses.filter((clause) => clause.topicBucket === bucket);
}
