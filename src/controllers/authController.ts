import { NextFunction, Request, Response } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "../services/authService";
import { matchedData } from "express-validator/lib";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = matchedData(req);
    const name = email
      .substring(0, email.indexOf("@"))
      .replace(/^./, (c: string) => c.toUpperCase())
      .slice(0, 50);
    const { accessToken, refreshToken } = await registerUser(email, password, name);
    res.status(201).json({
      message: "Registration successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, rememberMe } = matchedData(req);
    const { accessToken, refreshToken } = await loginUser(
      email,
      password,
      rememberMe
    );
    res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refreshTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = matchedData(req);
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await refreshAccessToken(refreshToken);
    res
      .status(200)
      .json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = matchedData(req);

    await logoutUser(refreshToken);

    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    next(err);
  }
};
