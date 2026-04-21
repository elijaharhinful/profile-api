# Profile API

A REST API that accepts a name, enriches it using external demographic APIs, stores the result in **PostgreSQL** using Prisma, and exposes endpoints to query and manage profiles with advanced filtering, pagination, and a Natural Language Processing search interface.

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL (via Prisma ORM)
- **ID generation**: UUID v7

---

## Local Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL running locally or remotely (e.g. Supabase, Neon)

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd profile-api

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set your DATABASE_URL

# 4. Migrate database schema and seed
npx prisma db push
npx ts-node src/lib/seed.ts

# 5. Run in development mode
npm run dev

# 6. Or build and run in production
npm run build
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |

---

## API Endpoints

### POST `/api/profiles`

Creates a new profile by enriching the given name via external APIs.

**Request body:**
```json
{ "name": "ella" }
```

**201 Created** (new profile):
```json
{
  "status": "success",
  "data": {
    "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DRC",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00.000Z"
  }
}
```

**200 OK** (profile already exists):
```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": { ...existing profile... }
}
```

---

### GET `/api/profiles/:id`

Returns a single profile by UUID.

**200 OK:**
```json
{
  "status": "success",
  "data": { ...profile... }
}
```

**404 Not Found** if the ID doesn't exist.

---

### GET `/api/profiles`

Returns all profiles. Supports multiple combinable filters, sorting, and pagination.

**Query Parameters:**
- `gender` ("male" or "female")
- `age_group` ("child", "teenager", "adult", "senior")
- `country_id` (ISO code, e.g., "NG")
- `min_age` (Exact minimum age, inclusive)
- `max_age` (Exact maximum age, inclusive)
- `min_gender_probability` (Float)
- `min_country_probability` (Float)
- `sort_by` ("age", "created_at", "gender_probability")
- `order` ("asc", "desc")
- `page` (default: 1)
- `limit` (default: 10, max: 50)

**200 OK:**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/profiles/search` (Natural Language Query)

Parses plain English queries to return filtered profiles. Uses pagination similar to `/api/profiles`.

**Example:**
`GET /api/profiles/search?q=young males from nigeria` -> Maps to `min_age=16`, `max_age=24`, `gender=male`, `country_id=NG`.

#### Natural Language Parsing Approach
The engine utilizes a rule-based parser that scans the query string using Regex for predefined demographic keywords and transforms them into structured filters:
- **Age Groups**: Detects words like `children/child` (`age_group=child`), `teenager/teenagers` (`age_group=teenager`), `adult/adults` (`age_group=adult`), `senior/seniors` (`age_group=senior`). The keyword `young` maps implicitly to `min_age=16` and `max_age=24`.
- **Gender**: Matches `male/males` and `female/females`. If both genders are mentioned (e.g. "males and females"), they cancel each other out, applying no gender filter.
- **Geography**: Intercepts the phrase `from [country_name]` and queries a cached dictionary to resolve the exact mapping to `country_id` (e.g. from "gabon" to "GA").
- **Quantitative Boundaries**: Extracts numbers following keywords for dynamic boundaries. `above/over X` maps to `min_age=X`. `under/below X` maps to `max_age=X`.

#### Logic & Limitations
- **Approach**: The parser builds an accumulator object containing bounds. Multiple parameters can be cleanly aggregated. If no rules generate matches during evaluation, a `400 Bad Request` with `Unable to interpret query` is returned.
- **Limitations & Unsupported Cases**:
  - The parsing is strict rule-based, meaning typos (e.g. "teanagers") are completely ignored and will not apply filters.
  - Queries lacking the explicit `from` prefix prior to geographic details (e.g. "nigeria adults") will fail to properly extract the location.
  - Cross-referencing conditional logic (e.g. "males over 30 OR females under 20") is not natively supported to keep the API logic streamlined.

---

### POST `/api/profiles`
Creates a new profile by enriching the given name via external APIs.

### GET `/api/profiles/:id`
Returns a single profile by UUID.

### DELETE `/api/profiles/:id`
Deletes a profile by UUID.

- **204 No Content** on success
- **404 Not Found** if ID doesn't exist

---

## Error Responses

| Code | Cause |
|---|---|
| 400 | Missing or empty parameter, or *Unable to interpret query* |
| 422 | Invalid parameter type |
| 404 | Profile not found |
| 500/502 | Server failure / API issues |

All errors follow this structure:
```json
{ "status": "error", "message": "<error message>" }
```
---

## Classification Rules

| Age Range | Group |
|---|---|
| 0–12 | child |
| 13–19 | teenager |
| 20–59 | adult |
| 60+ | senior |

Nationality is picked as the country with the **highest probability** from the Nationalize API response.

---

## Edge Cases

- If `Genderize` returns `gender: null` or `count: 0` → **502**, profile not stored
- If `Agify` returns `age: null` → **502**, profile not stored
- If `Nationalize` returns no country data → **502**, profile not stored
- Duplicate name submissions return the existing profile (idempotent)
- All query parameter filtering is case-insensitive

---

## Deployment

Set the `DATABASE_URL` environment variable to your production PostgreSQL connection string (e.g. Neon, Supabase) before deploying.

---

## CORS

The API sets `Access-Control-Allow-Origin: *` on all responses.
