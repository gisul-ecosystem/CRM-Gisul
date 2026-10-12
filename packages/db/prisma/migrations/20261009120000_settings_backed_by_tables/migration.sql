CREATE TYPE "DataTransferKind" AS ENUM ('IMPORT', 'EXPORT');

ALTER TABLE "appSetting" ADD COLUMN "pipelineProbabilityTracking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "pipelineRequireStageNotes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "pipelineAutoAssignDeals" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appSetting" ADD COLUMN "pipelineDefaultStage" "DealStage" NOT NULL DEFAULT 'DEMO_BOOKED';
ALTER TABLE "appSetting" ADD COLUMN "pipelineApplyToAllProducts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "appSetting" ADD COLUMN "pipelineAllowSkippingStages" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "pipelineStage" (
    "stage" "DealStage" NOT NULL,
    "name" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelineStage_pkey" PRIMARY KEY ("stage")
);

INSERT INTO "pipelineStage" ("stage", "name", "probability", "color", "position", "active", "updatedAt") VALUES
    ('DEMO_BOOKED', 'New', 10, '#9aa0b4', 1, true, CURRENT_TIMESTAMP),
    ('QUALIFIED_TO_BUY', 'Qualified', 30, '#8a4fd0', 2, true, CURRENT_TIMESTAMP),
    ('DECISION_MAKER_BOUGHT_IN', 'Proposal', 50, '#4a63d6', 3, true, CURRENT_TIMESTAMP),
    ('CONTRACT_SENT', 'Negotiation', 80, '#e0a21a', 4, true, CURRENT_TIMESTAMP),
    ('CLOSED_WON', 'Won', 100, '#1a9b6a', 5, true, CURRENT_TIMESTAMP),
    ('CLOSED_LOST', 'Lost', 0, '#e0455a', 6, true, CURRENT_TIMESTAMP),
    ('UNQUALIFIED_TO_BUY', 'Unqualified', 0, '#c45c6a', 7, true, CURRENT_TIMESTAMP);

CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

INSERT INTO "team" ("id", "name") VALUES
    ('team_sales', 'Sales'),
    ('team_product', 'Product'),
    ('team_marketing', 'Marketing'),
    ('team_customer_success', 'Customer Success');

CREATE TABLE "memberTeam" (
    "memberId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "memberTeam_pkey" PRIMARY KEY ("memberId")
);

CREATE INDEX "memberTeam_teamId_idx" ON "memberTeam"("teamId");

ALTER TABLE "memberTeam" ADD CONSTRAINT "memberTeam_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberTeam" ADD CONSTRAINT "memberTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workspaceBackup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaceBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspaceBackup_createdAt_idx" ON "workspaceBackup"("createdAt");

CREATE TABLE "dataTransfer" (
    "id" TEXT NOT NULL,
    "kind" "DataTransferKind" NOT NULL,
    "entity" "FieldEntity" NOT NULL,
    "filename" TEXT,
    "rowCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dataTransfer_createdAt_idx" ON "dataTransfer"("createdAt");

UPDATE "member" SET "role" = 'member' WHERE "role" NOT IN ('owner', 'admin', 'member');
