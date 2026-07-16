-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL DEFAULT 'welcome',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "abandonedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "storeName" TEXT,
    "storeType" TEXT,
    "currentControl" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "productCreated" BOOLEAN NOT NULL DEFAULT false,
    "customerCreated" BOOLEAN NOT NULL DEFAULT false,
    "saleCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dashboardViewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_userId_key" ON "onboarding_progress"("userId");

-- CreateIndex
CREATE INDEX "onboarding_progress_userId_idx" ON "onboarding_progress"("userId");

-- CreateIndex
CREATE INDEX "onboarding_progress_completed_idx" ON "onboarding_progress"("completed");

-- CreateIndex
CREATE INDEX "onboarding_progress_version_idx" ON "onboarding_progress"("version");

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
