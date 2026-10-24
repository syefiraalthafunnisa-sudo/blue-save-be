import { RequestHandler } from "express";
import { matchedData } from "express-validator";
import redis from "../config/redis";

// Cache only validated, shared GET responses; authentication must run first.
export const responseCache = (namespace: string): RequestHandler => async (req, res, next) => {
  const data = matchedData(req);
  const key = `blue-save:v1:cache:${namespace}:${JSON.stringify(data)}`;
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      res.status(200).json(JSON.parse(cached));
      return;
    }
  } catch (error) {
    console.error("Redis cache read failed:", error);
  }

  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      void redis.set(key, JSON.stringify(body), "EX", 60).catch((error) => {
        console.error("Redis cache write failed:", error);
      });
    }
    return json(body);
  };
  next();
};
