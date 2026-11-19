CREATE TABLE "ClinicianAccessRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "licenseNumber" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    CONSTRAINT "ClinicianAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicianAccessRequest_email_status_idx"
    ON "ClinicianAccessRequest"("email", "status");

CREATE INDEX "ClinicianAccessRequest_status_createdAt_idx"
    ON "ClinicianAccessRequest"("status", "createdAt");
