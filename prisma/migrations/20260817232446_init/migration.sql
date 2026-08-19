-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('STANDARD', 'SPEEDY', 'PIGEON');

-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('IN_FLIGHT', 'DELIVERED', 'DRAFT', 'LOST');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PIGEON_FLIGHT_FEE', 'PIGEON_LOSS', 'FAUCET_REFILL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#1A8B9D',
    "pigeonCoins" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "paperStyle" TEXT NOT NULL DEFAULT 'classic-sand',
    "waxSealColor" TEXT NOT NULL DEFAULT '#1A8B9D',
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'STANDARD',
    "status" "LetterStatus" NOT NULL DEFAULT 'IN_FLIGHT',
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "selfieImageBase64" TEXT,
    "senderLat" DOUBLE PRECISION,
    "senderLng" DOUBLE PRECISION,
    "destLat" DOUBLE PRECISION,
    "destLng" DOUBLE PRECISION,
    "destAddress" TEXT,
    "distanceKm" DOUBLE PRECISION,
    "flightDurationSec" INTEGER,
    "pigeonSurvived" BOOLEAN,
    "pigeonNote" TEXT,
    "survivalRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "letterId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Letter_recipientId_deliverAt_idx" ON "Letter"("recipientId", "deliverAt");

-- CreateIndex
CREATE INDEX "Letter_senderId_createdAt_idx" ON "Letter"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
