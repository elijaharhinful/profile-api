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
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
}

export interface IProfile {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: Date;
}

export interface NLPFilter {
  gender?: string;
  age_group?: string;
  country_id?: string;
  min_age?: number;
  max_age?: number;
}

export interface SkipReasons {
  missing_fields: number;
  invalid_age: number;
  invalid_gender: number;
  invalid_age_group: number;
  invalid_probability: number;
  malformed_row: number;
  [key: string]: number;
}

export interface ValidRow {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: Date;
}
