import { PrismaClient } from "@prisma/client";
import { uuidv7 } from "uuidv7";
import fs from "fs";
import path from "path";
import { IProfile } from "../interfaces/interfaces";

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, "seed_profiles.json");
  const rawData = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(rawData);

  console.log(`Loaded ${data.profiles.length} profiles from seed file.`);

  const profilesToInsert = data.profiles.map((p: IProfile) => ({
    id: uuidv7(),
    name: p.name,
    gender: p.gender,
    gender_probability: p.gender_probability,
    age: p.age,
    age_group: p.age_group,
    country_id: p.country_id,
    country_name: p.country_name,
    country_probability: p.country_probability,
    created_at: new Date(),
  }));

  try {
    const result = await prisma.profile.createMany({
      data: profilesToInsert,
      skipDuplicates: true,
    });
    console.log(`Successfully seeded ${result.count} profiles!`);
  } catch (error) {
    console.error("Error seeding profiles:", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
