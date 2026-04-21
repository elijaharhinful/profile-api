import fs from "fs";
import path from "path";

let countryMap: Record<string, string> | null = null;

function getCountryMap() {
  if (!countryMap) {
    try {
      const filePath = path.join(__dirname, "..", "lib", "seed_profiles.json");
      const rawData = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(rawData);
      countryMap = {};
      for (const p of data.profiles) {
        if (p.country_name && p.country_id) {
          countryMap[p.country_name.toLowerCase()] = p.country_id;
        }
      }
    } catch (e) {
      console.error("Failed to load country map for NLP", e);
      countryMap = {};
    }
  }
  return countryMap;
}

export function parseNaturalLanguageQuery(
  query: string,
): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  const lowerQuery = query.toLowerCase();
  let matched = false;

  // Age Groups
  if (/\byoung\b/.test(lowerQuery)) {
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }
  if (/\b(?:child|children)\b/.test(lowerQuery)) {
    filters.age_group = "child";
    matched = true;
  }
  if (/\bteenagers?\b/.test(lowerQuery)) {
    filters.age_group = "teenager";
    matched = true;
  }
  if (/\badults?\b/.test(lowerQuery)) {
    filters.age_group = "adult";
    matched = true;
  }
  if (/\bseniors?\b/.test(lowerQuery)) {
    filters.age_group = "senior";
    matched = true;
  }

  // Gender
  const hasMale = /\bmales?\b/.test(lowerQuery);
  const hasFemale = /\bfemales?\b/.test(lowerQuery);

  if (hasMale && hasFemale) {
    matched = true;
  } else if (hasFemale) {
    filters.gender = "female";
    matched = true;
  } else if (hasMale) {
    filters.gender = "male";
    matched = true;
  }

  // Country
  const countryMatch = lowerQuery.match(/\bfrom\s([a-z\s]+)(?:$|\s)/);
  if (countryMatch) {
    const rawCountry = countryMatch[1].trim();
    const cmap = getCountryMap();
    if (cmap[rawCountry]) {
      filters.country_id = cmap[rawCountry];
      matched = true;
    } else {
      matched = true;
    }
  }

  // Age constraints
  const aboveMatch = lowerQuery.match(/\b(?:above|over)\s+(\d+)\b/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1], 10);
    matched = true;
  }

  const belowMatch = lowerQuery.match(/\b(?:below|under)\s+(\d+)\b/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1], 10);
    matched = true;
  }

  if (!matched) {
    throw new Error("Unable to interpret query");
  }

  return filters;
}
