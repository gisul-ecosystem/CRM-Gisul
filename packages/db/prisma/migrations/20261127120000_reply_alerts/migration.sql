-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "replyAlertEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "replyAlertOwners" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "replyAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "replyAlert" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recipients" TEXT[],
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "replyAlert_messageId_key" ON "replyAlert"("messageId");

-- CreateIndex
CREATE INDEX "replyAlert_receivedAt_idx" ON "replyAlert"("receivedAt");

