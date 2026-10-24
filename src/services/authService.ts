import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  findUserByEmail,
  createUser,
  addRefreshToken,
  removeRefreshToken,
  findUserByRefreshToken,
  getUserRefreshTokens,
  rotateRefreshToken,
} from "../repositories/authRepository";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt";
import HttpError from "../utils/HttpError";
import { Role } from "../types";

export const registerUser = async (
  email: string,
  password: string,
  name: string
) => {
  const user = await findUserByEmail(email);

  if (user) {
    throw new HttpError("Email already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await createUser({
    email,
    password: hashedPassword,
    name,
    role: Role.USER,
  });

  return loginUser(email, password);
};

export const loginUser = async (
  email: string,
  password: string,
  rememberMe: boolean = false
) => {
  const user = await findUserByEmail(email);
  if (!user || !user.password || !(await bcrypt.compare(password, user.password)))
    throw new HttpError("Incorrect email or password", 401);

  const refreshToken = generateRefreshToken(user.id, rememberMe);

  const refreshTokens = await getUserRefreshTokens(user.id);
  if (refreshTokens.length >= 2) {
    await removeRefreshToken(refreshTokens[0].token);
  }

  await addRefreshToken(user.id, refreshToken);

  return {
    accessToken: generateAccessToken(user.id, user.name, user.email),
    refreshToken,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const user = await findUserByRefreshToken(refreshToken);

  if (!user) throw new HttpError("Invalid refresh token", 403);

  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
  } catch (err) {
    throw new HttpError("Invalid or expired refresh token", 403);
  }
  if (typeof payload === "string" || payload.id !== user.id) {
    throw new HttpError("Invalid refresh token", 403);
  }

  const rememberMe = typeof payload.exp === "number" &&
    typeof payload.iat === "number" && payload.exp - payload.iat > 7 * 86400;
  const newRefreshToken = generateRefreshToken(user.id, rememberMe);
  if (!(await rotateRefreshToken(user.id, refreshToken, newRefreshToken))) {
    throw new HttpError("Invalid refresh token", 403);
  }
  return {
    accessToken: generateAccessToken(user.id, user.name, user.email),
    refreshToken: newRefreshToken,
  };
};

export const logoutUser = async (refreshToken: string) => {
  const user = await findUserByRefreshToken(refreshToken);
  if (!user) throw new HttpError("Invalid refresh token", 403);

  await removeRefreshToken(refreshToken);
};
