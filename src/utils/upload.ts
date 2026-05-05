import multer from "multer";

// csv-parse streams from the buffer so the file is never written to disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else if (file.size > 50 * 1024 * 1024) {
      cb(new Error("File size exceeds 50MB limit"));
    } else {
      cb(new Error("Only CSV files are accepted"));
    }
  },
});
