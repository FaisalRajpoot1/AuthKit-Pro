-- CreateEnum
CREATE TYPE "login_token_type" AS ENUM ('MAGIC_LINK', 'EMAIL_OTP');

-- AlterEnum
ALTER TYPE "audit_action" ADD VALUE 'PASSWORDLESS_LOGIN_REQUESTED';

-- CreateTable
CREATE TABLE "login_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "login_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_tokens_token_hash_key" ON "login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "login_tokens_user_id_idx" ON "login_tokens"("user_id");

-- CreateIndex
CREATE INDEX "login_tokens_expires_at_idx" ON "login_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
