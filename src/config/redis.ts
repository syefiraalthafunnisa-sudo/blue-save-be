import "dotenv/config";
import Redis from "ioredis";

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return Number(value);
}

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: integerEnv("REDIS_PORT", 6379, 1, 65535),
  db: integerEnv("REDIS_DB", 0, 0, Number.MAX_SAFE_INTEGER),
  password: process.env.REDIS_PASSWORD || undefined,
  connectTimeout: 1000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 1,
});

redis.on("error", (error) => console.error("Redis error:", error.message));

export default redis;
