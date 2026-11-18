# CareNavigator — AI-Assisted Clinical Triage & Care Navigation Platform

Demo -https://care-navigator-delta.vercel.app/login
to view the website create an account.

**CareNavigator** is a full-stack, HIPAA-conscious healthcare assessment and care-navigation web application built around the **"Sanctuary of Clinical Clarity"** design system. It combines multimodal AI symptom intake (chat, voice, clinical photos, and lab PDFs), a deterministic clinical red-flag safety engine, grounded clinical guideline retrieval (GINA, ACP, NICE), longitudinal health records, human-in-the-loop clinician verification, and smart specialist routing.

> **Medical Disclaimer**: CareNavigator provides AI-assisted clinical decision support and care navigation. All AI outputs are non-diagnostic considerations and do not replace professional medical advice, diagnosis, or treatment. In Bangladesh, call **999** or proceed to the nearest emergency department immediately.

---

## 1. Repository Structure & Reference Documentation

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — Complete 11-screen inventory, 4-variant design-system audit, token normalization specification, full-stack architecture, external service matrix, and 6-milestone implementation plan.
- [`AGENTS.md`](./AGENTS.md) — Permanent engineering, design-system, clinical safety, security, and verification rules governing all development on CareNavigator.
- [`prisma/schema.prisma`](./prisma/schema.prisma) & [`prisma/seed.ts`](./prisma/seed.ts) — Relational database schema and clinical fixture seeder (`isSeedFixture: true`).
- [`design-reference_/`](./design-reference_) — Original design references containing all 11 screen directories (`code.html` + `screen.png`) and 4 `DESIGN.md` specifications. *(Read-only visual reference; never overwrite.)*

---

## 2. Application Screens & Route Architecture

| # | Screen Name | Design Reference Directory | Application Route | Shell Layout | Primary Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Public Landing Page** | `carenavigator_ai_assisted_triage_care_navigation` | `/` | Public Marketing Shell | Public / Patient |
| 2 | **Patient Dashboard** | `carenavigator_patient_dashboard` | `/dashboard` | Patient Workspace (`w-64` Sidebar) | Patient |
| 3 | **AI Health Assessment & Triage Workspace** | `ai_health_assessment_triage_workspace` | `/assessments/new` | Patient Workspace (`w-64` Sidebar) | Patient |
| 4 | **Media & Voice Assessment** | `media_voice_assessment` | `/assessments/media-voice` | Patient Workspace (`w-64` Sidebar) | Patient |
| 5 | **Patient Health Profile & Documents** | `patient_health_profile_documents` | `/records` | Patient Workspace (`w-64` Sidebar) | Patient |
| 6 | **Clinical Assessment Results** | `clinical_assessment_results` | `/assessments/[id]/results` | Patient Workspace (`w-64` Sidebar) | Patient / Clinician |
| 7 | **Assessment History & Clinician Review Tracker** | `assessment_history_clinician_review_tracker` | `/assessments/history` | Patient Workspace (`w-64` Sidebar) | Patient / Clinician |
| 8 | **Doctor & Facility Directory** | `doctor_directory` | `/care-directory` | Public / Patient Responsive Shell | Public / Patient |
| 9 | **Privacy, Consent & Communication Settings** | `carenavigator_privacy_communication_settings` | `/settings/privacy` | Patient Workspace (`w-64` Sidebar) | Patient |
| 10 | **Notification Center** | `carenavigator_notification_center` | `/notifications` | Patient Workspace (`w-64` Sidebar) | Patient |
| 11 | **Admin & Clinical Operations Impact Dashboard** | `admin_impact_dashboard` | `/admin/impact` | Clinician & Admin Portal Shell | Admin / CMO |

---

## 3. Tech Stack & External Dependencies

| Layer | Package / Dependency | Purpose |
| :--- | :--- | :--- |
| **Application Framework** | `next@^15.1.7`, `react@^19.0.0`, `typescript@^5.7.3` | Full-stack App Router, Server Components, Route Handlers, strict type system |
| **Styling & Design System** | `tailwindcss@^3.4.17`, `clsx`, `tailwind-merge` | Canonical CareNavigator M3 color tokens, semantic acuity tokens, responsive layouts |
| **Database & Schema ORM** | `@prisma/client@^6.4.1`, `prisma@^6.4.1`, `tsx` | Local SQLite (`prisma/schema.prisma`) and a managed PostgreSQL deployment schema (`prisma/postgres/schema.prisma`) |
| **Authentication & Security** | `jose@^6.0.8`, `zod@^3.24.2` | HMAC-SHA256 HTTP-only JWT session signing, server RBAC & ownership guards, env/input validation |
| **AI & Multimodal SDK** | `@google/genai` | Google Gemini API integration for symptom intake, lab OCR, and voice transcription |
| **Testing & Quality** | `vitest@^3.0.6`, `@testing-library/react`, `eslint` | Automated unit/integration testing, static analysis, and build checks |

---

## 4. Setup Commands & Local Development Workflow

### 4.1 Environment Configuration
Copy [`.env.example`](./.env.example) to `.env` (or `.env.local`) in the project root:

```bash
cp .env.example .env
```

All variables in [`.env.example`](./.env.example) are validated at server startup by [`src/lib/env.ts`](./src/lib/env.ts):
- `DATABASE_URL`: Defaults to `"file:./dev.db"` for zero-config local relational persistence (can be pointed to PostgreSQL in production).
- `DIRECT_URL`: Direct PostgreSQL connection used only for production Prisma migrations.
- `AUTH_SECRET`: Secret key (`>=16` chars) used to sign HTTP-only session JWTs.
- `AI_ASSESSMENT_PROVIDER`: Selects `gemini` or local `ollama` MedGemma. Without a configured provider, triage transparently uses deterministic clinical safety rules.
- `GEMINI_API_KEY`: Required only when using Gemini. It can be left blank for local Ollama or deterministic fallback mode.
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`: Local MedGemma service settings. See [`docs/MEDGEMMA_OLLAMA.md`](./docs/MEDGEMMA_OLLAMA.md) to set it up.
- `LOCAL_VAULT_DIR`: Private medical document storage directory outside `public/` (defaults to `.local-vault`).

> **Security Rule**: Never prefix `GEMINI_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, or storage keys with `NEXT_PUBLIC_`. [`src/lib/env.ts`](./src/lib/env.ts) actively throws a security error if any secret is exposed via `NEXT_PUBLIC_`.

### 4.2 Install, Migrate & Seed
Run the following commands from the repository root:

```bash
# 1. Install all dependencies
npm install

# 2. Apply Prisma migrations & generate Prisma Client
npm run db:migrate

# 3. Seed longitudinal clinical fixtures (isSeedFixture: true)
npm run db:seed

# 4. Start the local development server
npm run dev
```

### 4.3 Quality, Typecheck, Lint & Test Scripts

```bash
# Run TypeScript compiler typecheck
npm run typecheck

# Run ESLint code-quality checks
npm run lint

# Run automated unit & database integration tests (Vitest)
npm test

# Build production application bundle
npm run build
```

### 4.4 Deploy to Vercel

Vercel deployments use the PostgreSQL schema. Do not use the local SQLite file for production: serverless instances do not provide durable local file storage.

1. Import `samfort33/Care_Navigator` into Vercel and keep the project root at `./`.
2. Add a PostgreSQL integration from the Vercel Marketplace. Prisma Postgres provides `DATABASE_URL` (direct, for migrations) and `DATABASE_URL_POOLED` (pooled, for application requests).
3. Add a unique `AUTH_SECRET` with at least 32 characters. Set `NEXTAUTH_URL` to the deployed site URL.
4. Keep these values in Vercel’s encrypted environment settings. Never commit them to GitHub or expose them with a `NEXT_PUBLIC_` prefix.
5. Deploy the `main` branch. `vercel.json` runs `npm run vercel-build`, which applies PostgreSQL migrations on production deployments before building the Next.js app. Non-production deployments are skipped until they have an isolated Preview database, so Preview code cannot reach the Production database.

The local developer workflow remains SQLite-backed: `npm run dev` generates the local Prisma Client before starting Next.js. Production migrations live separately under `prisma/postgres/migrations`.

Patient media and voice uploads are disabled on Vercel until a durable private object-storage adapter is configured. Vercel function filesystems are ephemeral; the app reports this state at `/api/health` instead of accepting files that could disappear after a request.

> This deployment setup does not by itself establish HIPAA compliance or make the demo safe for real patient records. Review hosting agreements, privacy controls, access policies, and backups before storing any real health information.

---

## 5. Local Test Accounts

The seeded patient and clinician accounts are for local development only. They include synthetic health records and are rejected in production. To use them locally, seed your local database and enable fixture login in the same PowerShell session before starting the app:

```powershell
npm run db:seed
$env:CARE_NAVIGATOR_ENABLE_TEST_ACCOUNTS = "true"
npm run dev
```

Both test accounts use `Password123!`:

- Patient: `nusrat.jahan@carenavigator.example`
- Clinician: `ayesha.rahman@carenavigator.example`

The clinician fixture opens the clinician review workspace; the patient fixture opens the patient dashboard. Do not use these demo accounts for real health information. Public registration creates patient accounts only. Clinician access must be provisioned by a healthcare organization after verification.
