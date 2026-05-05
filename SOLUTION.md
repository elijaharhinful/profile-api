# Stage 4B: System Optimization & Data Ingestion

This document details the technical implementations applied to scale the Insighta Labs+ backend, specifically targeting latency reduction, database tuning, and high-volume data ingestion.

## 1. Query Normalization & Caching (Redis)

To minimize database latency and prevent redundant database queries:
- **Deterministic Normalization**: Implemented a normalizer (`normalizeQuery.ts`) that intercepts search requests and predictably sorts their keys and values. This guarantees that semantically identical filters (e.g., `?gender=male&age_group=adult` vs `?age_group=adult&gender=male`) always generate the exact same Redis cache key.

- **Redis Caching**: Cached the normalized results in Redis, significantly reducing DB load for repeated queries while ensuring immediate invalidation upon new data ingestion.

## 2. Database Optimization

To maintain rapid read performance (sub-100ms) as the dataset grows:
- **B-Tree Indexing**: Configured Prisma to apply optimal B-tree indexes to high-frequency search fields such as `country_id`, `age_group`, and `gender`. This drastically reduces sequential scanning for the API's core search operations.

## 3. Resilient Data Ingestion Pipeline

To ingest massive datasets (e.g., 500,000+ rows) efficiently and safely:
- **Memory-Efficient Streaming**: Replaced full-file loading with Node.js `Readable` streams and `csv-parse`. The file is streamed and processed row-by-row, keeping memory consumption low and constant regardless of file size.
- **Chunked Database Flushes**: Rows are aggregated and bulk-inserted in optimal chunk sizes (e.g., 500 rows) using parameterized `INSERT` statements to maximize write throughput.
- **Graceful Partial Failures**: Designed the pipeline to explicitly avoid transaction rollbacks. By using `INSERT ... ON CONFLICT (name) DO NOTHING`, duplicate records are silently ignored. If the network drops or the stream fatally crashes midway, the error handler safely halts parsing, preserves all previously flushed chunks, and returns a detailed `status: partial` JSON response outlining exactly what was inserted and skipped before the interruption.

## 4. Performance Benchmarks

### Latency Measurement on Remote Servers

API and Redis hosted on [leapcell.io](http://leapcell.io) N. Virginia, US East and Postgres DB is hosted on Supabase West EU (Ireland).

| **Query** | **Before (no index, no cache) (ms)** | **After indexes (ms)** | **After indexes + cache hit (ms)** |
| --- | --- | --- | --- |
| `GET /api/profiles` | 8288 | 2028 | 585 |
| `GET /api/profiles?gender=female&country_id=NG` | 5580 | 2882 | 365 |
| `GET /api/profiles/search?q="young males from nigeria"` | 7447 | 2404 | 982 |

### Latency Measurement on Localhost

| **Query** | **Before (no index, no cache) (ms)** | **After indexes (ms)** | **After indexes + cache hit (ms)** |
| --- | --- | --- | --- |
| `GET /api/profiles` | 3288 | 445 | 96 |
| `GET /api/profiles?gender=female&country_id=NG` | 3580 | 1282 | 265 |
| `GET /api/profiles/search?q="young males from nigeria"` | 4447 | 904 | 382 |
