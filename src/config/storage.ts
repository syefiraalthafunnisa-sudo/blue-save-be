import fs from "fs";
import path from "path";

export const uploadsDir = path.resolve(process.cwd(), "uploads");
export const reportUploadsDir = path.join(uploadsDir, "reports");

fs.mkdirSync(reportUploadsDir, { recursive: true });
