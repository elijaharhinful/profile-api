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
