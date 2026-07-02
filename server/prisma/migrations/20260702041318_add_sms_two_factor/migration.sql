-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "login_token_type" ADD VALUE 'TWO_FACTOR_SMS_OTP';
ALTER TYPE "login_token_type" ADD VALUE 'PHONE_VERIFICATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "phone_verified_at" TIMESTAMP(3);
