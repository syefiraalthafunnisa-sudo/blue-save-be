import { checkSchema } from "express-validator";

export const createPaymentValidation = checkSchema({
  amount: {
    in: ["body"],
    custom: {
      options: (value) => typeof value === "number" || typeof value === "string",
      errorMessage: "Amount must be a number or numeric string",
    },
    isDecimal: {
      options: { decimal_digits: "0,2" },
      errorMessage: "Amount must be a number with at most 2 decimal places",
    },
    isFloat: {
      options: { min: 0.01, max: 99999999.99 },
      errorMessage: "Amount must be between 0.01 and 99999999.99",
    },
    notEmpty: {
      errorMessage: "Amount is required",
    },
    toFloat: true,
  },
});
