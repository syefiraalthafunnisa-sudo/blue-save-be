import "dotenv/config";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const databaseUrl = `mysql://${encodeURIComponent(
  required("DB_USER"),
)}:${encodeURIComponent(required("DB_PASSWORD"))}@${required(
  "DB_HOST",
)}:${required("DB_PORT")}/${encodeURIComponent(required("DB_NAME"))}`;

process.env.DATABASE_URL ??= databaseUrl;
