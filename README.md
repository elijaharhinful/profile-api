# Profile API

A REST API that accepts a name, enriches it using Genderize, Agify, and Nationalize APIs, stores the result in MongoDB, and exposes endpoints to manage profiles.

---

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express
- **Database**: MongoDB (via Mongoose)
- **ID generation**: UUID v7

---

## Local Setup

### Prerequisites

- Node.js >= 18
- MongoDB running locally or a connection string (e.g. MongoDB Atlas)

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd profile-api

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set your MONGODB_URI

# 4. Run in development mode
npm run dev

# 5. Or build and run in production
npm run build
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `MONGODB_URI` | `mongodb://localhost:27017/profile-api` | MongoDB connection string |

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

Returns all profiles. Supports optional query filters (case-insensitive):

| Query Param | Example |
|---|---|
| `gender` | `?gender=male` |
| `country_id` | `?country_id=NG` |
| `age_group` | `?age_group=adult` |

**200 OK:**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": "...",
      "name": "emmanuel",
      "gender": "male",
      "age": 25,
      "age_group": "adult",
      "country_id": "NG"
    }
  ]
}
```

---

### DELETE `/api/profiles/:id`

Deletes a profile by UUID.

- **204 No Content** on success
- **404 Not Found** if ID doesn't exist

---

## Error Responses

All errors follow this structure:

```json
{ "status": "error", "message": "<error message>" }
```

| Code | Cause |
|---|---|
| 400 | Missing or empty `name` |
| 422 | Invalid type for `name` |
| 404 | Profile not found |
| 502 | External API returned invalid/null data |
| 500 | Internal server error |

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

Set the `MONGODB_URI` environment variable to your production MongoDB connection string (e.g. MongoDB Atlas) before deploying.

---

## CORS

The API sets `Access-Control-Allow-Origin: *` on all responses.
