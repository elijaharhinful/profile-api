interface GenderizeResponse {
  count: number;
  name: string;
  gender: string | null;
  probability: number;
}

interface AgifyResponse {
  count: number;
  name: string;
  age: number | null;
}

interface NationalizeResponse {
  count: number;
  name: string;
  country: { country_id: string; probability: number }[];
}

export interface EnrichedData {
  gender: string;
  gender_probability: number;
  sample_size: number;
  age: number;
  age_group: string;
  country_id: string;
  country_probability: number;
}

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
      `https://api.genderize.io?name=${encodedName}`
    );
  } catch {
    throw { statusCode: 502, api: "Genderize" };
  }

  try {
    agifyData = await fetchJson<AgifyResponse>(
      `https://api.agify.io?name=${encodedName}`
    );
  } catch {
    throw { statusCode: 502, api: "Agify" };
  }

  try {
    nationalizeData = await fetchJson<NationalizeResponse>(
      `https://api.nationalize.io?name=${encodedName}`
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
    a.probability > b.probability ? a : b
  );

  return {
    gender: genderData.gender,
    gender_probability: genderData.probability,
    sample_size: genderData.count,
    age: agifyData.age,
    age_group: getAgeGroup(agifyData.age),
    country_id: topCountry.country_id,
    country_probability: topCountry.probability,
  };
}
