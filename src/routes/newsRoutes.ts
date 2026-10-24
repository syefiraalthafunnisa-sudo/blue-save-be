import { Router } from "express";
import { getAllNews, getNewsById } from "../controllers/newsController";
import {
  getAllNewsValidator,
  getNewsValidator,
} from "../validators/newsValidator";
import { validationResultHandler } from "../middlewares/validationResultHandler";
import { responseCache } from "../middlewares/responseCache";

const router = Router();

router.get("/", getAllNewsValidator, validationResultHandler, responseCache("news-list"), getAllNews);

router.get("/:id", getNewsValidator, validationResultHandler, responseCache("news-detail"), getNewsById);

export default router;
