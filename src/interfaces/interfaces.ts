export interface GenderizeResponse {
  count: number;
  name: string;
  gender: string | null;
  probability: number;
}

export interface AgifyResponse {
  count: number;
  name: string;
  age: number | null;
}

export interface NationalizeResponse {
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
