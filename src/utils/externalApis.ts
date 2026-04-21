import {
  GenderizeResponse,
  AgifyResponse,
  NationalizeResponse,
  EnrichedData,
} from "../interfaces/interfaces";

function getAgeGroup(age: number): string {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function enrichName(name: string): Promise<EnrichedData> {
  const encodedName = encodeURIComponent(name);

  // Fetch all three APIs in parallel
  let genderData: GenderizeResponse;
  let agifyData: AgifyResponse;
  let nationalizeData: NationalizeResponse;

  try {
    genderData = await fetchJson<GenderizeResponse>(
      `https://api.genderize.io?name=${encodedName}`,
    );
  } catch {
    throw { statusCode: 502, api: "Genderize" };
  }

  try {
    agifyData = await fetchJson<AgifyResponse>(
      `https://api.agify.io?name=${encodedName}`,
    );
  } catch {
    throw { statusCode: 502, api: "Agify" };
  }

  try {
    nationalizeData = await fetchJson<NationalizeResponse>(
      `https://api.nationalize.io?name=${encodedName}`,
    );
  } catch {
    throw { statusCode: 502, api: "Nationalize" };
  }

  // Validate responses per spec
  if (!genderData.gender || genderData.count === 0) {
    throw { statusCode: 502, api: "Genderize" };
  }

  if (genderData.count === 0) {
    throw { statusCode: 502, api: "Genderize" };
  }

  if (agifyData.age === null || agifyData.age === undefined) {
    throw { statusCode: 502, api: "Agify" };
  }

  if (!nationalizeData.country || nationalizeData.country.length === 0) {
    throw { statusCode: 502, api: "Nationalize" };
  }

  // Pick country with highest probability
  const topCountry = nationalizeData.country.reduce((a, b) =>
    a.probability > b.probability ? a : b,
  );

  let country_name = "Unknown";
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    country_name = regionNames.of(topCountry.country_id) || "Unknown";
  } catch (e) {
    // ignore
  }

  return {
    gender: genderData.gender,
    gender_probability: genderData.probability,
    age: agifyData.age,
    age_group: getAgeGroup(agifyData.age),
    country_id: topCountry.country_id,
    country_name,
    country_probability: topCountry.probability,
  };
}
