import { Request, Response } from "express";
import { uuidv7 } from "uuidv7";
import { enrichName } from "../utils/externalApis";
import { prisma } from "../lib/prisma";
import { parseNaturalLanguageQuery } from "../utils/nlpParser";

// POST /api/profiles
export async function createProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const { name } = req.body;

  // Validate input
  if (!name || typeof name !== "string" || name.trim() === "") {
    if (name !== undefined && typeof name !== "string") {
      res.status(422).json({ status: "error", message: "Invalid type" });
      return;
    }
    res.status(400).json({ status: "error", message: "name is required" });
    return;
  }

  const normalizedName = name.trim().toLowerCase();

  // Check for existing profile (idempotency)
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

  // Enrich via external APIs
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

  // Create and save profile
  const profile = await prisma.profile.create({
    data: {
      id: uuidv7(),
      name: normalizedName,
      ...enriched,
      created_at: new Date(),
    },
  });

  res.status(201).json({
    status: "success",
    data: profile,
  });
}

// GET /api/profiles/:id
export async function getProfile(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;

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
  const {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
  } = req.query;

  let pageStr = req.query.page as string;
  let limitStr = req.query.limit as string;

  const page = pageStr ? parseInt(pageStr, 10) : 1;
  let limit = limitStr ? parseInt(limitStr, 10) : 10;
  if (limit > 50) limit = 50;

  const filter: any = {};

  if (gender && typeof gender === "string")
    filter.gender = gender.toLowerCase();
  if (age_group && typeof age_group === "string")
    filter.age_group = age_group.toLowerCase();
  if (country_id && typeof country_id === "string")
    filter.country_id = country_id.toUpperCase();

  if (min_age) {
    if (!filter.age) filter.age = {};
    filter.age.gte = parseInt(min_age as string, 10);
  }
  if (max_age) {
    if (!filter.age) filter.age = {};
    filter.age.lte = parseInt(max_age as string, 10);
  }
  if (min_gender_probability) {
    filter.gender_probability = {
      gte: parseFloat(min_gender_probability as string),
    };
  }
  if (min_country_probability) {
    filter.country_probability = {
      gte: parseFloat(min_country_probability as string),
    };
  }

  const orderBy: any = {};
  if (sort_by && typeof sort_by === "string") {
    const sortField = sort_by.toLowerCase();
    if (["age", "created_at", "gender_probability"].includes(sortField)) {
      orderBy[sortField] =
        order && typeof order === "string" && order.toLowerCase() === "desc"
          ? "desc"
          : "asc";
    }
  }

  try {
    const skip = (page - 1) * limit;
    const [total, data] = await prisma.$transaction([
      prisma.profile.count({ where: filter }),
      prisma.profile.findMany({
        where: filter,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// GET /api/profiles/search
export async function searchProfiles(
  req: Request,
  res: Response,
): Promise<void> {
  const q = req.query.q as string;
  if (!q) {
    res
      .status(400)
      .json({ status: "error", message: "Missing query parameter 'q'" });
    return;
  }

  let filter: any;
  try {
    filter = parseNaturalLanguageQuery(q);
  } catch (err: unknown) {
    res
      .status(400)
      .json({ status: "error", message: "Unable to interpret query" });
    return;
  }

  // Handle mapped min_age / max_age into Prisma filters
  const prismaFilter: any = {};
  if (filter.gender) prismaFilter.gender = filter.gender;
  if (filter.age_group) prismaFilter.age_group = filter.age_group;
  if (filter.country_id) prismaFilter.country_id = filter.country_id;
  if (filter.min_age !== undefined || filter.max_age !== undefined) {
    prismaFilter.age = {};
    if (filter.min_age !== undefined) prismaFilter.age.gte = filter.min_age;
    if (filter.max_age !== undefined) prismaFilter.age.lte = filter.max_age;
  }

  let pageStr = req.query.page as string;
  let limitStr = req.query.limit as string;
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  let limit = limitStr ? parseInt(limitStr, 10) : 10;
  if (limit > 50) limit = 50;

  try {
    const skip = (page - 1) * limit;
    const [total, data] = await prisma.$transaction([
      prisma.profile.count({ where: prismaFilter }),
      prisma.profile.findMany({
        where: prismaFilter,
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// DELETE /api/profiles/:id
export async function deleteProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.params.id as string;

  const result = await prisma.profile.deleteMany({ where: { id } });
  if (result.count === 0) {
    res.status(404).json({ status: "error", message: "Profile not found" });
    return;
  }

  res.status(204).send();
}
