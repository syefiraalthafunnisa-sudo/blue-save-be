import { checkSchema } from "express-validator";

export const registerValidation = checkSchema({
  email: {
    in: ["body"],
    isEmail: {
      errorMessage: "Invalid email format",
    },
    notEmpty: {
      errorMessage: "Email required",
    },
  },
  password: {
    in: ["body"],
    isLength: {
      options: { min: 8 },
      errorMessage: "Password must be at least 8 characters long",
    },
    notEmpty: {
      errorMessage: "Password required",
    },
    matches: {
      options:
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      errorMessage:
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    },
  },
});

export const loginValidation = checkSchema({
  email: {
    in: ["body"],
    isEmail: {
      errorMessage: "Invalid email format",
    },
    notEmpty: {
      errorMessage: "Email required",
    },
  },
  password: {
    in: ["body"],
    isLength: {
      options: { min: 8 },
      errorMessage: "Password must be at least 8 characters long",
    },
    notEmpty: {
      errorMessage: "Password required",
    },
    matches: {
      options:
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/,
      errorMessage:
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    },
  },
  rememberMe: {
    in: ["body"],
    optional: true,
    isBoolean: {
      errorMessage: "Remember me must be a boolean",
    },
    toBoolean: true,
  },
});

export const refreshTokenValidation = checkSchema({
  refreshToken: {
    in: ["body"],
    isString: {
      errorMessage: "Refresh token must be a string",
    },
    notEmpty: {
      errorMessage: "Refresh token required",
    },
  },
});

export const logoutValidation = checkSchema({
  refreshToken: {
    in: ["body"],
    isString: {
      errorMessage: "Refresh token must be a string",
    },
    notEmpty: {
      errorMessage: "Refresh token required",
    },
  },
});
