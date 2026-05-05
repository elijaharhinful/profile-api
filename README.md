# Insighta Labs+ API

The **Insighta Labs+ API** is the secure core of the Profile Intelligence System. It manages user authentication via GitHub OAuth with PKCE, enforces role-based access control (RBAC), enriches profile data from external demographic sources, and provides advanced querying capabilities via standard filters and a Natural Language Processing (NLP) interface.

---

## System Architecture

Insighta Labs+ operates as a unified platform with three main components:
1.  **Backend (profile-api)**: The central source of truth, managing data, security, and external API integrations.
2.  **CLI (insighta-cli)**: A powerful terminal tool for engineers and power users.
3.  **Web Portal (insighta-web)**: A user-friendly dashboard for analysts and stakeholders.

All interfaces share the same backend APIs, ensuring data consistency and centralized security enforcement.

---

## Tech Stack

-   **Runtime**: Node.js
-   **Language**: TypeScript
-   **Framework**: Express
-   **Database**: PostgreSQL (via Prisma ORM)
-   **Authentication**: GitHub OAuth 2.0 with PKCE
-   **Tokens**: JWT (JSON Web Tokens) for sessions
-   **ID Generation**: UUID v7

---

## Authentication & Security

### GitHub OAuth with PKCE
The system implements a secure OAuth flow using Proof Key for Code Exchange (PKCE) to protect against authorization code injection.
-   **CLI Flow**: The CLI initiates the flow, opens the browser for GitHub auth, and captures the callback via a temporary local server.
-   **Web Flow**: The web portal handles the redirect flow directly via browser sessions.

### Token Lifecycle
-   **Access Token**: Short-lived (3 minutes) for active requests.
-   **Refresh Token**: Medium-lived (5 minutes). Used to issue a new access/refresh token pair. The old refresh token is invalidated immediately upon use.
-   **Storage**: 
    -   **Web**: HTTP-only cookies (secure, SameSite=Lax).
    -   **CLI**: Stored locally in `~/.insighta/credentials.json`.

### Security Features
-   **CSRF Protection**: Token-based protection for web clients.
-   **Rate Limiting**: 
    -   Auth endpoints: 10 requests / minute.
    -   API endpoints: 60 requests / minute per user.
-   **API Versioning**: Requires `X-API-Version: 1` header on all `/api/*` requests.

---

## Role Enforcement (RBAC)

The system enforces strict access control based on user roles:

| Role | Permissions |
|---|---|
| **admin** | Full access: View, Search, Create, and Delete profiles. |
| **analyst** | Read-only access: View and Search profiles. |

*Default role for new users is `analyst`.*

---

## Local Setup

### Prerequisites
-   Node.js >= 18
-   PostgreSQL
-   GitHub OAuth App credentials

### Steps
1.  **Clone & Install**:
    ```bash
    git clone <repo-url>
    cd profile-api
    npm install
    ```
2.  **Environment**:
    ```bash
    cp .env.example .env
    # Fill in DATABASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, JWT_SECRET, etc.
    ```
3.  **Database**:
    ```bash
    npx prisma db push
    npx ts-node src/lib/seed.ts
    ```
4.  **Run**:
    ```bash
    npm run dev
    ```

---

## API Endpoints

### Authentication (`/auth/*`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/auth/github` | Initiates GitHub OAuth flow. |
| GET | `/auth/github/callback` | Handles OAuth callback and issues tokens. |
| POST | `/auth/refresh` | Refreshes access token using a refresh token. |
| POST | `/auth/logout` | Invalidates the current session. |
| GET | `/auth/me` | Returns current user profile and role. |

### Profiles (`/api/profiles/*`)
*All endpoints require `Authorization: Bearer <token>` and `X-API-Version: 1` headers.*

#### GET `/api/profiles`
Returns paginated profiles with filters.
-   **Filters**: `gender`, `age_group`, `country_id`, `min_age`, `max_age`, etc.
-   **Sorting**: `sort_by` (age, created_at), `order` (asc, desc).
-   **Response**:
    ```json
    {
      "status": "success",
      "page": 1,
      "total_pages": 20,
      "links": { "self": "...", "next": "...", "prev": null },
      "data": [...]
    }
    ```

#### GET `/api/profiles/search?q=<query>`
Natural Language Search. (e.g., `young males from nigeria`)

#### POST `/api/profiles` (Admin Only)
Creates and enriches a new profile.

#### GET `/api/profiles/export?format=csv`
Exports the current filtered list of profiles to a CSV file.

---

## Natural Language Parsing

The NLP engine uses a rule-based parser to translate English queries into API filters:
-   **Keywords**: `young` (16-24), `child`, `teenager`, `adult`, `senior`.
-   **Gender**: `male`, `female`.
-   **Geography**: `from <country>` (mapped to ISO codes).
-   **Quantitative**: `above <age>`, `under <age>`.

---

## Logging

Every request is logged with:
-   Timestamp, Method, Path, Status Code, and Duration (ms).
-   Authenticated User ID (if applicable).

---
