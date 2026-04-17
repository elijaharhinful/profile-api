import { Request, Response } from "express";
import { uuidv7 } from "uuidv7";
import { Profile } from "../models/Profile";
import { enrichName } from "../utils/externalApis";

// POST /api/profiles
export async function createProfile(req: Request, res: Response): Promise<void> {
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
  const existing = await Profile.findOne({ name: normalizedName });
  if (existing) {
    res.status(200).json({
      status: "success",
      message: "Profile already exists",
      data: existing.toJSON(),
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
  const profile = new Profile({
    id: uuidv7(),
    name: normalizedName,
    ...enriched,
    created_at: new Date(),
  });

  await profile.save();

  res.status(201).json({
    status: "success",
    data: profile.toJSON(),
  });
}

// GET /api/profiles/:id
export async function getProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const profile = await Profile.findOne({ id });
  if (!profile) {
    res.status(404).json({ status: "error", message: "Profile not found" });
    return;
  }

  res.status(200).json({ status: "success", data: profile.toJSON() });
}

// GET /api/profiles
export async function getAllProfiles(req: Request, res: Response): Promise<void> {
  const { gender, country_id, age_group } = req.query;

  // Build filter object — query params are case-insensitive
  const filter: Record<string, unknown> = {};

  if (gender && typeof gender === "string") {
    filter.gender = gender.toLowerCase();
  }
  if (country_id && typeof country_id === "string") {
    filter.country_id = country_id.toUpperCase();
  }
  if (age_group && typeof age_group === "string") {
    filter.age_group = age_group.toLowerCase();
  }

  const profiles = await Profile.find(filter);

  const data = profiles.map((p) => {
    const json = p.toJSON();
    return {
      id: json.id,
      name: json.name,
      gender: json.gender,
      age: json.age,
      age_group: json.age_group,
      country_id: json.country_id,
    };
  });

  res.status(200).json({
    status: "success",
    count: data.length,
    data,
  });
}

// DELETE /api/profiles/:id
export async function deleteProfile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const result = await Profile.deleteOne({ id });
  if (result.deletedCount === 0) {
    res.status(404).json({ status: "error", message: "Profile not found" });
    return;
  }

  res.status(204).send();
}
