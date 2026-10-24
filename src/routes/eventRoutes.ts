import { Router } from "express";
import passport from "passport";
import {
  getAllEvents,
  getEventById,
  registerForEvent,
} from "../controllers/eventController";
import {
  getAllEventsValidator,
  getEventAndRegisterEventValidator,
} from "../validators/eventValidator";
import { validationResultHandler } from "../middlewares/validationResultHandler";
import { eventRegisterLimiter } from "../middlewares/rateLimiter";
import { responseCache } from "../middlewares/responseCache";

const router = Router();

router.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  getAllEventsValidator,
  validationResultHandler,
  responseCache("events-list"),
  getAllEvents
);

router.get(
  "/:eventId",
  passport.authenticate("jwt", { session: false }),
  getEventAndRegisterEventValidator,
  validationResultHandler,
  responseCache("events-detail"),
  getEventById
);

router.post(
  "/register/:eventId",
  passport.authenticate("jwt", { session: false }),
  eventRegisterLimiter,
  getEventAndRegisterEventValidator,
  validationResultHandler,
  registerForEvent
);

export default router;
