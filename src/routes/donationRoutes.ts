import { Router } from "express";
import { createPayment } from "../controllers/donationController";
import passport from "passport";
import { createPaymentValidation } from "../validators/donationValidator";
import { validationResultHandler } from "../middlewares/validationResultHandler";

const router = Router();

router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  createPaymentValidation,
  validationResultHandler,
  createPayment
);

export default router;
