import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { unlink } from "fs/promises";

export const validationResultHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
      try {
        await unlink(req.file.path);
      } catch (err) {
        next(err);
        return;
      }
    }
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};
