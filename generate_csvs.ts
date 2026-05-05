import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "test_csvs");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const HEADERS =
  "name,gender,gender_probability,age,age_group,country_id,country_name,country_probability";

const COUNTRIES = [
  ["NG", "Nigeria"],
  ["US", "United States"],
  ["GH", "Ghana"],
  ["GB", "United Kingdom"],
  ["ZA", "South Africa"],
  ["KE", "Kenya"],
  ["IN", "India"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["BR", "Brazil"],
  ["JP", "Japan"],
  ["CN", "China"],
  ["EG", "Egypt"],
  ["ET", "Ethiopia"],
  ["TZ", "Tanzania"],
  ["UG", "Uganda"],
  ["SN", "Senegal"],
  ["CI", "Cote d'Ivoire"],
];

const FIRST_NAMES = [
  "Amara",
  "Bolu",
  "Chidi",
  "Dayo",
  "Emeka",
  "Funmi",
  "Gbenga",
  "Hauwa",
  "Ifeoma",
  "Jide",
  "Kemi",
  "Lola",
  "Musa",
  "Ngozi",
  "Ola",
  "Pita",
  "Qudus",
  "Remi",
  "Sola",
  "Tunde",
  "Uche",
  "Voke",
  "Wale",
  "Xola",
  "Yemi",
  "Zara",
  "Adaeze",
  "Babatunde",
  "Chiamaka",
  "Dimma",
  "Efosa",
  "Folake",
  "Godwin",
  "Helen",
  "Ikenna",
  "Jumoke",
  "Kunle",
  "Lawal",
  "Mercy",
  "Nkem",
  "Obiora",
  "Patience",
  "Rasheed",
  "Seun",
  "Toyin",
  "Udoka",
  "Victor",
  "Wunmi",
  "Ximena",
  "Yvonne",
  "Zainab",
  "Ahmed",
  "Blessing",
  "Cynthia",
  "David",
  "Esther",
  "Felix",
  "Grace",
  "Henry",
  "Irene",
  "James",
  "Kehinde",
  "Lydia",
  "Moses",
  "Nora",
  "Onome",
  "Precious",
  "Queen",
  "Richard",
  "Susan",
  "Timothy",
  "Usman",
  "Vivian",
  "William",
  "Xerxes",
  "Yusuf",
];

const LAST_NAMES = [
  "Okonkwo",
  "Adesanya",
  "Mensah",
  "Osei",
  "Diallo",
  "Traore",
  "Kamara",
  "Ibrahim",
  "Musa",
  "Yusuf",
  "Adekunle",
  "Bakare",
  "Chukwu",
  "Dada",
  "Eze",
  "Fashola",
  "Ganiyu",
  "Hassan",
  "Idowu",
  "Johnson",
  "Kalu",
  "Lawal",
  "Mba",
  "Nwosu",
  "Ogundele",
  "Peters",
  "Quadri",
  "Raji",
  "Salami",
  "Taiwo",
  "Usman",
  "Vincent",
  "Williams",
  "Xavier",
  "Yakubu",
];

// Helper to generate a valid row
function generateValidRow(index: number, nameOverride?: string): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const name = nameOverride || `${first} ${last} ${index}`;

  const gender = Math.random() > 0.5 ? "male" : "female";
  const gender_probability = (Math.random() * (0.99 - 0.6) + 0.6).toFixed(4); // 0.6 - 0.99
  const age = Math.floor(Math.random() * 85) + 1; // 1 to 85

  let age_group = "adult";
  if (age <= 12) age_group = "child";
  else if (age <= 19) age_group = "teenager";
  else if (age >= 60) age_group = "senior";

  const countryIndex = Math.floor(Math.random() * COUNTRIES.length);
  const country_id = COUNTRIES[countryIndex][0];
  const country_name = COUNTRIES[countryIndex][1];
  const country_probability = (Math.random() * (0.95 - 0.5) + 0.5).toFixed(4); // 0.5 - 0.95

  return `${name},${gender},${gender_probability},${age},${age_group},${country_id},${country_name},${country_probability}`;
}

// 1. Generate 1000 valid rows
function generateValid1000() {
  const rows = [HEADERS];
  for (let i = 0; i < 1000; i++) {
    rows.push(generateValidRow(i));
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "valid_1000.csv"), rows.join("\n"));
  console.log("✅ Created valid_1000.csv");
}

// 2. Generate with 10 duplicate names (1000 rows total, 10 are duplicates)
function generateWithDuplicates() {
  const rows = [HEADERS];
  const duplicateNames = [];

  for (let i = 0; i < 990; i++) {
    const row = generateValidRow(i);
    rows.push(row);
    if (i < 10) {
      // Save the first 10 names to duplicate later
      duplicateNames.push(row.split(",")[0]);
    }
  }

  // Add the 10 duplicates
  for (let i = 0; i < 10; i++) {
    rows.push(generateValidRow(990 + i, duplicateNames[i]));
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "duplicates_10.csv"), rows.join("\n"));
  console.log("✅ Created duplicates_10.csv");
}

// 3. Generate with 5 rows missing name
function generateMissingNames() {
  const rows = [HEADERS];
  for (let i = 0; i < 1000; i++) {
    let row = generateValidRow(i);
    if (i < 5) {
      // Replace the name (first column) with empty string
      const parts = row.split(",");
      parts[0] = "";
      row = parts.join(",");
    }
    rows.push(row);
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "missing_name_5.csv"),
    rows.join("\n"),
  );
  console.log("✅ Created missing_name_5.csv");
}

// 4. Generate with 3 rows with invalid age (-5)
function generateInvalidAge() {
  const rows = [HEADERS];
  for (let i = 0; i < 1000; i++) {
    let row = generateValidRow(i);
    if (i < 3) {
      // Replace age (4th column, index 3) with -5
      const parts = row.split(",");
      parts[3] = "-5";
      row = parts.join(",");
    }
    rows.push(row);
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "invalid_age_3.csv"), rows.join("\n"));
  console.log("✅ Created invalid_age_3.csv");
}

// 5. Generate malformed CSV row (wrong column count)
function generateMalformedRow() {
  const rows = [HEADERS];
  for (let i = 0; i < 1000; i++) {
    if (i === 0) {
      // Malformed row: missing the last column completely (7 columns instead of 8)
      rows.push("MalformedUser,male,0.9,30,adult,US,United States");
    } else {
      rows.push(generateValidRow(i));
    }
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "malformed_row_1.csv"),
    rows.join("\n"),
  );
  console.log("✅ Created malformed_row_1.csv");
}

// 6. Generate 50000 valid rows
function generateValid50000() {
  const rows = [HEADERS];
  for (let i = 0; i < 50000; i++) {
    rows.push(generateValidRow(i));
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, "valid_50000.csv"), rows.join("\n"));
  console.log("✅ Created valid_50000.csv");
}

// Run all generators
function run() {
  console.log("Generating test CSV files...");
  generateValid1000();
  generateWithDuplicates();
  generateMissingNames();
  generateInvalidAge();
  generateMalformedRow();
  generateValid50000();
  console.log(`\nAll files saved to: ${OUTPUT_DIR}`);
}

run();
