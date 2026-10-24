import { Router } from "express";
import {
  register,
  login,
  refreshTokenHandler,
  logout,
} from "../controllers/authController";
import {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  logoutValidation,
} from "../validators/authValidator";
import { validationResultHandler } from "../middlewares/validationResultHandler";
import {
  registerLimiter,
  loginLimiter,
  refreshTokenLimiter,
} from "../middlewares/rateLimiter";

const router = Router();

router.post(
  "/register",
  registerLimiter,
  registerValidation,
  validationResultHandler,
  register
);

router.post(
  "/login",
  loginLimiter,
  loginValidation,
  validationResultHandler,
  login
);

router.post(
  "/refresh-token",
  refreshTokenLimiter,
  refreshTokenValidation,
  validationResultHandler,
  refreshTokenHandler
);

router.post("/logout", logoutValidation, validationResultHandler, logout);


export default router;
