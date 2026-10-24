import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof MulterError
    ? (err.code === "LIMIT_FILE_SIZE" ? 413 : 400)
    : err.statusCode || err.status || 500;
  if (statusCode >= 500) console.error(err);
  res
    .status(statusCode)
    .json({ message: statusCode >= 500 ? "Internal Server Error" : err.message });
};
