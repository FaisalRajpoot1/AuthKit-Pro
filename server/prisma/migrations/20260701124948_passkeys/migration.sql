-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "audit_action" ADD VALUE 'PASSKEY_REGISTERED';
ALTER TYPE "audit_action" ADD VALUE 'PASSKEY_REMOVED';
ALTER TYPE "audit_action" ADD VALUE 'PASSKEY_LOGIN';

-- CreateTable
CREATE TABLE "passkeys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "device_type" TEXT,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
