-- CreateEnum
CREATE TYPE "ChecklistKind" AS ENUM ('ONBOARDING', 'OFFBOARDING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "jiraBaseUrl" TEXT,
ADD COLUMN     "jiraDefaultProject" TEXT,
ADD COLUMN     "jiraEmail" TEXT,
ADD COLUMN     "jiraIssueType" TEXT DEFAULT 'Epic',
ADD COLUMN     "jiraTokenEnc" TEXT;

-- CreateTable
CREATE TABLE "ChecklistTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "ChecklistKind" NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ADMIN',
    "dueDate" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneByName" TEXT,
    "assignmentId" TEXT,
    "seatId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "category" TEXT,
    "costPerSeat" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "seatsPurchased" INTEGER,
    "renewalDate" DATE,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseSeat" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountEmail" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LicenseSeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTask_employeeId_kind_idx" ON "ChecklistTask"("employeeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "License_organizationId_name_key" ON "License"("organizationId", "name");

-- CreateIndex
CREATE INDEX "LicenseSeat_licenseId_revokedAt_idx" ON "LicenseSeat"("licenseId", "revokedAt");

-- CreateIndex
CREATE INDEX "LicenseSeat_employeeId_idx" ON "LicenseSeat"("employeeId");

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTask" ADD CONSTRAINT "ChecklistTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseSeat" ADD CONSTRAINT "LicenseSeat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseSeat" ADD CONSTRAINT "LicenseSeat_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseSeat" ADD CONSTRAINT "LicenseSeat_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
