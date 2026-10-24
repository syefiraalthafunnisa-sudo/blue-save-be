-- Email verification is no longer required; preserve all user accounts.
ALTER TABLE "User"
DROP COLUMN "otp",
DROP COLUMN "otpExpiresAt",
DROP COLUMN "verified";
