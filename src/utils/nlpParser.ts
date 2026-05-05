import fs from "fs";
import path from "path";

let countryMap: Record<string, string> | null = null;
let sortedCountryNames: string[] = [];

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
      sortedCountryNames = Object.keys(countryMap).sort(
        (a, b) => b.length - a.length,
      );
    } catch (e) {
      console.error("Failed to load country map for NLP", e);
      countryMap = {};
      sortedCountryNames = [];
    }
  }
  return { cmap: countryMap, names: sortedCountryNames };
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
  const hasMale = /\b(?:males?|men|man|boys?|guys?)\b/.test(lowerQuery);
  const hasFemale = /\b(?:females?|women|woman|girls?|ladies)\b/.test(
    lowerQuery,
  );

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
  const { cmap, names } = getCountryMap();
  for (const countryName of names) {
    const escapedCountryName = countryName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    // Match the country name, optionally followed by common demonym suffixes (n, an, ian)
    const regex = new RegExp(`\\b${escapedCountryName}(?:n|an|ian)?\\b`);
    if (regex.test(lowerQuery)) {
      filters.country_id = cmap[countryName];
      matched = true;
      break;
    }
  }

  // Age constraints
  // e.g. "between ages 20 and 45"
  const betweenMatch = lowerQuery.match(
    /\bbetween\s+(?:ages?\s+)?(\d+)\s+and\s+(\d+)\b/,
  );
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1], 10);
    filters.max_age = parseInt(betweenMatch[2], 10);
    matched = true;
  }

  // e.g. "aged 20-45" or "ages 20 to 45" or "ages 20–45"
  const rangeMatch = lowerQuery.match(
    /\b(?:aged?|ages?)\s+(\d+)\s*(?:[-–—]|to)\s*(\d+)\b/,
  );
  if (rangeMatch) {
    filters.min_age = parseInt(rangeMatch[1], 10);
    filters.max_age = parseInt(rangeMatch[2], 10);
    matched = true;
  }

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
