import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export const generateAccessToken = (
  userId: string,
  name: string,
  email: string
) => {
  return jwt.sign({ id: userId, name, email }, process.env.JWT_SECRET!, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (
  userId: string,
  rememberMe: boolean = false
) => {
  const expiresIn = rememberMe ? "30d" : "7d";
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn,
    jwtid: randomUUID(),
  });
};
