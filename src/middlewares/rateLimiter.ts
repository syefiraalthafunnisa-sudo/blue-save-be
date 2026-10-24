import rateLimit from "express-rate-limit";
import { RedisStore, RedisReply } from "rate-limit-redis";
import redis from "../config/redis";

const store = (name: string) => new RedisStore({
  prefix: `blue-save:v1:rate-limit:${name}:`,
  sendCommand: async (...args: string[]) => await redis.call(args[0], ...args.slice(1)) as RedisReply,
});

export const registerLimiter = rateLimit({
  store: store("register"),
  windowMs: 30 * 60 * 1000,
  max: 3,
  message: { error: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  store: store("login"),
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const refreshTokenLimiter = rateLimit({
  store: store("refresh-token"),
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many refresh token requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const eventRegisterLimiter = rateLimit({
  store: store("event-register"),
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many event registration attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalLimiter = rateLimit({
  store: store("global"),
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
