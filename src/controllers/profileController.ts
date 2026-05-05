import { Request, Response } from "express";
import { uuidv7 } from "uuidv7";
import { enrichName } from "../utils/externalApis";
import { prisma } from "../lib/prisma";
import { parseNaturalLanguageQuery } from "../utils/nlpParser";
import { Prisma } from "@prisma/client";
import { NLPFilter } from "../interfaces/interfaces";
import { cacheGet, cacheSet, cacheFlush } from "../lib/redis";
import { buildCacheKey } from "../utils/normalizeQuery";

// Helpers

function buildFilter(query: Record<string, unknown>): Prisma.ProfileWhereInput {
  const str = (v: unknown): string | undefined =>
    v && typeof v === "string"
      ? v
      : Array.isArray(v)
        ? (v[0] as string)
        : undefined;
  const filter: Prisma.ProfileWhereInput = {};

  const gender = str(query.gender);
  const age_group = str(query.age_group);
  const country_id = str(query.country_id);
  const min_age = str(query.min_age);
  const max_age = str(query.max_age);
  const min_gender_probability = str(query.min_gender_probability);
  const min_country_probability = str(query.min_country_probability);

  if (gender) filter.gender = gender.toLowerCase();
  if (age_group) filter.age_group = age_group.toLowerCase();
  if (country_id) filter.country_id = country_id.toUpperCase();

  if (min_age || max_age) {
    filter.age = {};
    if (min_age) (filter.age as Prisma.IntFilter).gte = parseInt(min_age, 10);
    if (max_age) (filter.age as Prisma.IntFilter).lte = parseInt(max_age, 10);
  }
  if (min_gender_probability)
    filter.gender_probability = { gte: parseFloat(min_gender_probability) };
  if (min_country_probability)
    filter.country_probability = { gte: parseFloat(min_country_probability) };

  return filter;
}

function buildOrderBy(
  query: Record<string, unknown>,
): Prisma.ProfileOrderByWithRelationInput {
  const { sort_by, order } = query;
  const orderBy: Prisma.ProfileOrderByWithRelationInput = {};
  if (sort_by && typeof sort_by === "string") {
    const validFields = ["age", "created_at", "gender_probability"];
    const sortField = sort_by.toLowerCase();
    if (validFields.includes(sortField)) {
      const sortOrder: Prisma.SortOrder = order === "desc" ? "desc" : "asc";
      (orderBy as Record<string, unknown>)[sortField] = sortOrder;
    }
  }
  return orderBy;
}

function buildLinks(
  baseUrl: string,
  page: number,
  limit: number,
  total: number,
) {
  const totalPages = Math.ceil(total / limit);
  const base = baseUrl.split("?")[0];
  const buildUrl = (p: number) => `${base}?page=${p}&limit=${limit}`;
  return {
    self: buildUrl(page),
    next: page < totalPages ? buildUrl(page + 1) : null,
    prev: page > 1 ? buildUrl(page - 1) : null,
  };
}

// POST /api/profiles

export async function createProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    if (name !== undefined && typeof name !== "string") {
      res.status(422).json({ status: "error", message: "Invalid type" });
      return;
    }
    res.status(400).json({ status: "error", message: "name is required" });
    return;
  }

  const normalizedName = name.trim().toLowerCase();

  const existing = await prisma.profile.findUnique({
    where: { name: normalizedName },
  });
  if (existing) {
    res.status(200).json({
      status: "success",
      message: "Profile already exists",
      data: existing,
    });
    return;
  }

  let enriched;
  try {
    enriched = await enrichName(normalizedName);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; api?: string };
    if (e.statusCode === 502 && e.api) {
      res.status(502).json({
        status: "error",
        message: `${e.api} returned an invalid response`,
      });
      return;
    }
    res.status(500).json({ status: "error", message: "Internal server error" });
    return;
  }

  const profile = await prisma.profile.create({
    data: {
      id: uuidv7(),
      name: normalizedName,
      ...enriched,
      created_at: new Date(),
    },
  });

  // Invalidate cached profile lists so new data is immediately visible
  await cacheFlush("profiles:*");

  res.status(201).json({ status: "success", data: profile });
}

// GET /api/profiles/:id

export async function getProfile(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) {
    res.status(404).json({ status: "error", message: "Profile not found" });
    return;
  }
  res.status(200).json({ status: "success", data: profile });
}

// GET /api/profiles

export async function getAllProfiles(
  req: Request,
  res: Response,
): Promise<void> {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = Math.min(
    req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
    50,
  );
  const skip = (page - 1) * limit;

  const rawFilter = req.query as Record<string, unknown>;
  const filter = buildFilter(rawFilter);
  const orderBy = buildOrderBy(rawFilter);
  const cacheKey = buildCacheKey(rawFilter, page, limit);

  try {
    // Cache read
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(JSON.parse(cached));
      return;
    }

    const [total, data] = await prisma.$transaction([
      prisma.profile.count({ where: filter }),
      prisma.profile.findMany({ where: filter, orderBy, skip, take: limit }),
    ]);

    const total_pages = Math.ceil(total / limit);
    const links = buildLinks(req.originalUrl, page, limit, total);

    const payload = {
      status: "success",
      page,
      limit,
      total,
      total_pages,
      links,
      data,
    };

    // Cache write
    cacheSet(cacheKey, JSON.stringify(payload)).catch(() => null);

    res.status(200).json(payload);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// GET /api/profiles/search

export async function searchProfiles(
  req: Request,
  res: Response,
): Promise<void> {
  const { q } = req.query;
  if (!q || typeof q !== "string" || q.trim().length === 0) {
    res
      .status(400)
      .json({ status: "error", message: "Missing query parameter 'q'" });
    return;
  }

  let parsed: NLPFilter;
  try {
    parsed = parseNaturalLanguageQuery(q) as NLPFilter;
  } catch {
    res
      .status(400)
      .json({ status: "error", message: "Unable to interpret query" });
    return;
  }

  const prismaFilter: Prisma.ProfileWhereInput = {};
  if (parsed.gender) prismaFilter.gender = parsed.gender;
  if (parsed.age_group) prismaFilter.age_group = parsed.age_group;
  if (parsed.country_id) prismaFilter.country_id = parsed.country_id;
  if (parsed.min_age !== undefined || parsed.max_age !== undefined) {
    prismaFilter.age = {};
    if (parsed.min_age !== undefined)
      (prismaFilter.age as Prisma.IntFilter).gte = parsed.min_age;
    if (parsed.max_age !== undefined)
      (prismaFilter.age as Prisma.IntFilter).lte = parsed.max_age;
  }

  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = Math.min(
    req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
    50,
  );
  const skip = (page - 1) * limit;

  const cacheKey = buildCacheKey(
    parsed as Record<string, unknown>,
    page,
    limit,
  );

  try {
    // Cache read
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(JSON.parse(cached));
      return;
    }

    const [total, data] = await prisma.$transaction([
      prisma.profile.count({ where: prismaFilter }),
      prisma.profile.findMany({ where: prismaFilter, skip, take: limit }),
    ]);

    const total_pages = Math.ceil(total / limit);
    const links = buildLinks(req.originalUrl, page, limit, total);

    const payload = {
      status: "success",
      page,
      limit,
      total,
      total_pages,
      links,
      data,
    };

    cacheSet(cacheKey, JSON.stringify(payload)).catch(() => null);

    res.status(200).json(payload);
  } catch {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// DELETE /api/profiles/:id

export async function deleteProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const id = String(req.params.id);
  const result = await prisma.profile.deleteMany({ where: { id } });
  if (result.count === 0) {
    res.status(404).json({ status: "error", message: "Profile not found" });
    return;
  }
  res.status(204).send();
}

// GET /api/profiles/export?format=csv

export async function exportProfiles(
  req: Request,
  res: Response,
): Promise<void> {
  if (req.query.format !== "csv") {
    res
      .status(400)
      .json({ status: "error", message: "format=csv is required" });
    return;
  }

  const filter = buildFilter(req.query as Record<string, unknown>);
  const orderBy = buildOrderBy(req.query as Record<string, unknown>);

  const profiles = await prisma.profile.findMany({ where: filter, orderBy });

  const columns = [
    "id",
    "name",
    "gender",
    "gender_probability",
    "age",
    "age_group",
    "country_id",
    "country_name",
    "country_probability",
    "created_at",
  ];

  const escape = (val: unknown) => {
    const s = String(val ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = profiles.map((p) =>
    columns.map((col) => escape((p as Record<string, unknown>)[col])).join(","),
  );

  const csv = [columns.join(","), ...rows].join("\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="profiles_${timestamp}.csv"`,
  );
  res.status(200).send(csv);
}
