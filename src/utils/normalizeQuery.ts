const FILTER_KEYS = [
  "gender",
  "age_group",
  "country_id",
  "min_age",
  "max_age",
  "min_gender_probability",
  "min_country_probability",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type RawFilter = Partial<Record<FilterKey, unknown>>;

export function normalizeFilter(raw: RawFilter): string {
  const canonical: Record<string, unknown> = {};

  for (const key of FILTER_KEYS) {
    const val = raw[key];
    // Keep only defined, non-null, non-empty-string values
    if (val !== undefined && val !== null && val !== "") {
      canonical[key] = val;
    }
  }

  // Keys are already iterated in the fixed FILTER_KEYS order (alphabetical),
  // so JSON.stringify output is deterministic without a sort step.
  return JSON.stringify(canonical);
}

// Builds the full cache key including pagination so pages cache independently.
export function buildCacheKey(
  filter: RawFilter,
  page: number,
  limit: number,
): string {
  return `profiles:${normalizeFilter(filter)}:p${page}:l${limit}`;
}
