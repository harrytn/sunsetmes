ALTER TABLE "Letter"
  ADD COLUMN "content" TEXT,
  ADD COLUMN "addressFrom" TEXT,
  ADD COLUMN "addressTo" TEXT,
  ALTER COLUMN "encryptedContent" DROP NOT NULL,
  ALTER COLUMN "iv" DROP NOT NULL,
  ALTER COLUMN "encryptedKeyRecipient" DROP NOT NULL,
  ALTER COLUMN "encryptedKeySender" DROP NOT NULL;
