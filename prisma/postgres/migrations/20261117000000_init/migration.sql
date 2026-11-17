-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "mrn" TEXT,
    "title" TEXT,
    "specialty" TEXT,
    "npiNumber" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "bloodType" TEXT NOT NULL,
    "primaryCarePhysician" TEXT NOT NULL,
    "insuranceProvider" TEXT NOT NULL,
    "insuranceMemberId" TEXT NOT NULL,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VitalSign" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "bloodPressure" TEXT NOT NULL,
    "heartRateBpm" INTEGER NOT NULL,
    "spO2Percent" INTEGER NOT NULL,
    "weightLbs" DOUBLE PRECISION NOT NULL,
    "temperatureF" DOUBLE PRECISION NOT NULL DEFAULT 98.6,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VitalSign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalCondition" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "severity" TEXT NOT NULL DEFAULT 'MODERATE',
    "diagnosedDate" TEXT,
    "notes" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MedicalCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "prescribedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "rxNumber" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "instructions" TEXT,
    "prescriberName" TEXT NOT NULL,
    "pharmacyName" TEXT,
    "refillsRemaining" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "prescribedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'SEVERE',
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDocument" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'LAB_RESULTS',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "orderingClinician" TEXT,
    "facilityName" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'COMPLETE',
    "aiPlainSummary" TEXT,
    "clinicalObservations" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MedicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedBiomarker" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "referenceRange" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT 'NORMAL',
    "interpretation" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExtractedBiomarker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestReport" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "panelCategory" TEXT NOT NULL,
    "specimenType" TEXT,
    "orderingProvider" TEXT NOT NULL,
    "performingLab" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallResult" TEXT NOT NULL DEFAULT 'NORMAL',
    "clinicalSummary" TEXT,
    "pdfStorageKey" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalGuideline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "publisher" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "publicationYear" INTEGER NOT NULL,
    "publicationDate" TEXT,
    "reviewDate" TEXT,
    "specialty" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyRecommendations" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "supersededById" TEXT,
    "retirementReason" TEXT,
    "keywords" TEXT NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineChunk" (
    "id" TEXT NOT NULL,
    "guidelineId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "sectionNumber" TEXT,
    "pageNumber" INTEGER,
    "passageText" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL DEFAULT '[]',
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidelineChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageSession" (
    "id" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "acuityLevel" TEXT NOT NULL DEFAULT 'ROUTINE',
    "confidenceScore" INTEGER NOT NULL DEFAULT 90,
    "recommendedCareSetting" TEXT NOT NULL,
    "plainLanguageSummary" TEXT NOT NULL,
    "includeEhrContext" BOOLEAN NOT NULL DEFAULT true,
    "redFlagTriggered" BOOLEAN NOT NULL DEFAULT false,
    "redFlagReasonsJson" TEXT NOT NULL DEFAULT '[]',
    "extractedEntitiesJson" TEXT NOT NULL DEFAULT '{}',
    "differentialJson" TEXT NOT NULL DEFAULT '[]',
    "visitPrepQuestionsJson" TEXT NOT NULL DEFAULT '[]',
    "voiceTranscript" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TriageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionPrompt" TEXT NOT NULL,
    "answerValue" TEXT NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentExplanation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "factorType" TEXT NOT NULL,
    "factorLabel" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "importanceRank" INTEGER NOT NULL DEFAULT 1,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentStatusHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "transitionReason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedMedia" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "triageSessionId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "processingProgress" INTEGER NOT NULL DEFAULT 0,
    "extractedSummary" TEXT,
    "extractedDataJson" TEXT DEFAULT '{}',
    "errorMessage" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageCitation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "guidelineId" TEXT NOT NULL,
    "chunkId" TEXT,
    "passageText" TEXT,
    "sectionTitle" TEXT,
    "sectionNumber" TEXT,
    "pageNumber" INTEGER,
    "sourceUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "relevanceNote" TEXT NOT NULL,
    "claimSupported" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianReview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'REVIEWING',
    "concordanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "overriddenAcuity" TEXT,
    "clinicianNote" TEXT,
    "actionRequiredNote" TEXT,
    "requestedFileType" TEXT,
    "supplementalDocId" TEXT,
    "reviewLatencySeconds" INTEGER NOT NULL DEFAULT 194,
    "signedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClinicianReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "previousStage" TEXT,
    "newStage" TEXT NOT NULL,
    "overriddenAcuity" TEXT,
    "rationale" TEXT NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "subspecialty" TEXT,
    "npiNumber" TEXT NOT NULL,
    "hospitalAffiliation" TEXT NOT NULL,
    "locationAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'San Francisco Bay Area',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "triageMatchPercent" INTEGER NOT NULL,
    "acceptedInsurancesJson" TEXT NOT NULL DEFAULT '[]',
    "telehealthAvailable" BOOLEAN NOT NULL DEFAULT true,
    "availableToday" BOOLEAN NOT NULL DEFAULT true,
    "inNetworkHospital" BOOLEAN NOT NULL DEFAULT true,
    "consultationFee" INTEGER NOT NULL DEFAULT 150,
    "bio" TEXT NOT NULL,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareReferral" (
    "id" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "triageSessionId" TEXT,
    "specialtyNeeded" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "clinicalSummary" TEXT NOT NULL,
    "referralStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "appointmentDate" TIMESTAMP(3),
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'TELEHEALTH',
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "slotId" TEXT,
    "triageSessionId" TEXT,
    "reason" TEXT NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'TELEHEALTH',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "preVisitNotes" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpRecord" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "triageSessionId" TEXT,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "clinicalObjective" TEXT NOT NULL,
    "outcomeNotes" TEXT,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionHref" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "includeEhrContext" BOOLEAN NOT NULL DEFAULT true,
    "storeVoiceTranscripts" BOOLEAN NOT NULL DEFAULT true,
    "deidentifiedModelImprovement" BOOLEAN NOT NULL DEFAULT false,
    "automatedHieSync" BOOLEAN NOT NULL DEFAULT true,
    "commCriticalEmail" BOOLEAN NOT NULL DEFAULT true,
    "commCriticalSms" BOOLEAN NOT NULL DEFAULT true,
    "commCriticalPush" BOOLEAN NOT NULL DEFAULT true,
    "commReviewEmail" BOOLEAN NOT NULL DEFAULT true,
    "commReviewSms" BOOLEAN NOT NULL DEFAULT true,
    "commReviewPush" BOOLEAN NOT NULL DEFAULT true,
    "commAppointmentEmail" BOOLEAN NOT NULL DEFAULT true,
    "commAppointmentSms" BOOLEAN NOT NULL DEFAULT true,
    "commAppointmentPush" BOOLEAN NOT NULL DEFAULT false,
    "commPreventiveEmail" BOOLEAN NOT NULL DEFAULT true,
    "commPreventiveSms" BOOLEAN NOT NULL DEFAULT false,
    "commPreventivePush" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "auditCode" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "anonymizedPatientRef" TEXT,
    "aiAcuity" TEXT,
    "finalAcuity" TEXT,
    "latencySeconds" INTEGER,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "isSeedFixture" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mrn_key" ON "User"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_rxNumber_key" ON "Prescription"("rxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalGuideline_code_key" ON "ClinicalGuideline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TriageSession_sessionCode_key" ON "TriageSession"("sessionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianReview_sessionId_key" ON "ClinicianReview"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_npiNumber_key" ON "DoctorProfile"("npiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CareReferral_referralCode_key" ON "CareReferral"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentPreference_userId_key" ON "ConsentPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_auditCode_key" ON "AuditLog"("auditCode");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCondition" ADD CONSTRAINT "MedicalCondition_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedBiomarker" ADD CONSTRAINT "ExtractedBiomarker_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestReport" ADD CONSTRAINT "TestReport_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineChunk" ADD CONSTRAINT "GuidelineChunk_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "ClinicalGuideline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageSession" ADD CONSTRAINT "TriageSession_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentExplanation" ADD CONSTRAINT "AssessmentExplanation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentStatusHistory" ADD CONSTRAINT "AssessmentStatusHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedMedia" ADD CONSTRAINT "UploadedMedia_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedMedia" ADD CONSTRAINT "UploadedMedia_triageSessionId_fkey" FOREIGN KEY ("triageSessionId") REFERENCES "TriageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageMessage" ADD CONSTRAINT "TriageMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageCitation" ADD CONSTRAINT "TriageCitation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageCitation" ADD CONSTRAINT "TriageCitation_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "ClinicalGuideline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageCitation" ADD CONSTRAINT "TriageCitation_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "GuidelineChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianReview" ADD CONSTRAINT "ClinicianReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TriageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianReview" ADD CONSTRAINT "ClinicianReview_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ClinicianReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareReferral" ADD CONSTRAINT "CareReferral_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareReferral" ADD CONSTRAINT "CareReferral_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareReferral" ADD CONSTRAINT "CareReferral_triageSessionId_fkey" FOREIGN KEY ("triageSessionId") REFERENCES "TriageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_triageSessionId_fkey" FOREIGN KEY ("triageSessionId") REFERENCES "TriageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpRecord" ADD CONSTRAINT "FollowUpRecord_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpRecord" ADD CONSTRAINT "FollowUpRecord_triageSessionId_fkey" FOREIGN KEY ("triageSessionId") REFERENCES "TriageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentPreference" ADD CONSTRAINT "ConsentPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

