CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED');
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'LINKEDIN', 'REFERRAL', 'COLD_OUTREACH', 'DIRECT', 'OTHER');

CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "detailedDescription" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "iconUrl" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_status_idx" ON "product"("status");
CREATE INDEX "product_position_idx" ON "product"("position");
CREATE INDEX "product_archivedAt_idx" ON "product"("archivedAt");

ALTER TABLE "contact" ADD COLUMN "productId" TEXT;
ALTER TABLE "contact" ADD COLUMN "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "contact" ADD COLUMN "leadSource" "LeadSource";
ALTER TABLE "contact" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);

ALTER TABLE "deal" ADD COLUMN "productId" TEXT;

ALTER TABLE "appSetting" ADD COLUMN "productShowInLeadCreation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "productShowInCustomerCreation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "productShowInDealCreation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "productDefaultId" TEXT;
ALTER TABLE "appSetting" ADD COLUMN "productAllowMultipleOnDeal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "contact_productId_idx" ON "contact"("productId");
CREATE INDEX "contact_leadStatus_idx" ON "contact"("leadStatus");
CREATE INDEX "contact_leadSource_idx" ON "contact"("leadSource");
CREATE INDEX "contact_nextFollowUpAt_idx" ON "contact"("nextFollowUpAt");
CREATE INDEX "deal_productId_idx" ON "deal"("productId");

ALTER TABLE "contact" ADD CONSTRAINT "contact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deal" ADD CONSTRAINT "deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
