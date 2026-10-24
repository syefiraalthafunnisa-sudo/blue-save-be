import { Request, Response, NextFunction } from "express";
import { createTransaction } from "../services/donationService";
import { matchedData } from "express-validator/lib";

export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount } = matchedData(req);
    const { id: userId } = (req as any).user;
    const transaction = await createTransaction(amount, userId);

    res.status(200).json({
      message: "Donation successful",
      transaction,
    });
  } catch (err) {
    next(err);
  }
};
