import { Response } from "express";
import { parse } from "csv-parse";
import fs from "fs";
import { uuidv7 } from "uuidv7";
import { prisma } from "../lib/prisma";
import { cacheFlush } from "../lib/redis";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { SkipReasons, ValidRow } from "../interfaces/interfaces";

const CHUNK_SIZE = 500;
const MAX_ROWS = 500000;

const VALID_GENDERS = new Set(["male", "female"]);
const VALID_AGE_GROUPS = new Set(["child", "teenager", "adult", "senior"]);

// Expected CSV columns (order must match the file spec)
const REQUIRED_COLUMNS = [
  "name",
  "gender",
  "gender_probability",
  "age",
  "age_group",
  "country_id",
  "country_name",
  "country_probability",
];

// Row validation

function validateRow(
  record: Record<string, string>,
  reasons: SkipReasons,
): ValidRow | null {
  if (Object.keys(record).length !== REQUIRED_COLUMNS.length) {
    reasons.malformed_row++;
    return null;
  }

  const {
    name,
    gender,
    gender_probability,
    age,
    age_group,
    country_id,
    country_name,
    country_probability,
  } = record;

  // Required string fields
  if (!name?.trim() || !country_id?.trim() || !country_name?.trim()) {
    reasons.missing_fields++;
    return null;
  }

  // Gender
  const genderLow = gender?.trim().toLowerCase();
  if (!VALID_GENDERS.has(genderLow)) {
    reasons.invalid_gender++;
    return null;
  }

  // Age
  const ageNum = parseInt(age, 10);
  if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
    reasons.invalid_age++;
    return null;
  }

  // Age group
  const agGroupLow = age_group?.trim().toLowerCase();
  if (!VALID_AGE_GROUPS.has(agGroupLow)) {
    reasons.invalid_age_group++;
    return null;
  }

  // Probabilities (must be 0–1 floats)
  const genderProb = parseFloat(gender_probability);
  const countryProb = parseFloat(country_probability);
  if (
    isNaN(genderProb) ||
    genderProb < 0 ||
    genderProb > 1 ||
    isNaN(countryProb) ||
    countryProb < 0 ||
    countryProb > 1
  ) {
    reasons.invalid_probability++;
    return null;
  }

  return {
    id: uuidv7(),
    name: name.trim().toLowerCase(),
    gender: genderLow,
    gender_probability: genderProb,
    age: ageNum,
    age_group: agGroupLow,
    country_id: country_id.trim().toUpperCase(),
    country_name: country_name.trim(),
    country_probability: countryProb,
    created_at: new Date(),
  };
}

// Bulk insert one chunk

async function flushChunk(
  chunk: ValidRow[],
  inserted: { count: number },
  reasons: SkipReasons,
): Promise<void> {
  if (chunk.length === 0) return;

  // Build parameterised VALUES list
  const values: unknown[] = [];
  const placeholders = chunk.map((row, i) => {
    const base = i * 9;
    values.push(
      row.id,
      row.name,
      row.gender,
      row.gender_probability,
      row.age,
      row.age_group,
      row.country_id,
      row.country_name,
      row.country_probability,
    );
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},NOW())`;
  });

  const result = await prisma.$executeRawUnsafe(
    `INSERT INTO "Profile" (id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (name) DO NOTHING`,
    ...values,
  );

  // result i.e the number of rows actually inserted
  const skippedInChunk = chunk.length - result;
  inserted.count += result;
  reasons.duplicate_name = (reasons.duplicate_name ?? 0) + skippedInChunk;
}

// POST /api/profiles/import

export async function importProfiles(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      status: "error",
      message:
        "No file uploaded. Use multipart/form-data with field name 'file'.",
    });
    return;
  }

  const reasons: SkipReasons = {
    missing_fields: 0,
    invalid_age: 0,
    invalid_gender: 0,
    invalid_age_group: 0,
    invalid_probability: 0,
    malformed_row: 0,
    duplicate_name: 0,
  };
  const inserted = { count: 0 };
  let total_rows = 0;
  const chunk: ValidRow[] = [];

  // Stream the file through csv-parse row by row
  const stream = fs.createReadStream(req.file.path);
  const parser = stream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }),
  );

  try {
    for await (const record of parser) {
      total_rows++;

      if (total_rows > MAX_ROWS) {
        res.status(413).json({
          status: "error",
          message: `File exceeds maximum limit of ${MAX_ROWS} rows. Partial import completed.`,
          total_rows: MAX_ROWS,
          inserted: inserted.count,
          skipped: MAX_ROWS - inserted.count,
          reasons: cleanReasons(reasons),
        });
        return;
      }

      const row = validateRow(record as Record<string, string>, reasons);
      if (!row) continue;

      chunk.push(row);

      if (chunk.length >= CHUNK_SIZE) {
        await flushChunk(chunk, inserted, reasons);
        chunk.length = 0; // reset buffer in place
      }
    }

    // Flush any remaining rows
    if (chunk.length > 0) {
      await flushChunk(chunk, inserted, reasons);
    }

    // Invalidate cached profile lists so new data is immediately visible
    await cacheFlush("profiles:*");

    const skipped = total_rows - inserted.count;
    res.status(200).json({
      status: "success",
      total_rows,
      inserted: inserted.count,
      skipped,
      reasons: cleanReasons(reasons),
    });
  } catch (err) {
    // Return a partial result if we failed midway
    const skipped = total_rows - inserted.count;
    res.status(200).json({
      status: "partial",
      message:
        "Processing failed partway through. Rows already inserted have been kept.",
      total_rows,
      inserted: inserted.count,
      skipped,
      reasons: cleanReasons(reasons),
    });
  } finally {
    // Always clean up the temporary file
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }
  }
}

// Remove zero-count reason keys to keep the response clean
function cleanReasons(reasons: SkipReasons): Partial<SkipReasons> {
  return Object.fromEntries(
    Object.entries(reasons).filter(([, v]) => v > 0),
  ) as Partial<SkipReasons>;
}
