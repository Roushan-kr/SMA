# SmartMettr — Backend Documentation

> **Express.js · TypeScript · Prisma ORM · PostgreSQL · Clerk Auth · Cloudinary / AWS S3**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Mermaid Diagrams](#3-mermaid-diagrams)
4. [Folder Structure](#4-folder-structure)
5. [Authentication & RBAC](#5-authentication--rbac)
6. [Storage Abstraction](#6-storage-abstraction)
7. [System Hardening Layer](#7-system-hardening-layer)
8. [API Module Summary](#8-api-module-summary)
9. [Deployment Considerations](#9-deployment-considerations)
10. [Future Improvements](#10-future-improvements)

---

## 1. Project Overview

### Purpose

**SmartMettr** is a multi-tenant electricity smart-meter management backend. It provides:

- **Meter lifecycle management** — provisioning, assignment, and status tracking of smart meters linked to electricity consumers.
- **Billing engine** — generating billing reports from meter readings, supporting tariff-based calculations, versioned recalculation, and consumer bill-view tracking.
- **Consumer self-service** — a Clerk-authenticated portal where consumers can view their profile, bills, notifications, and submit support queries.
- **AI-assisted support** — a query pipeline where consumer questions can be auto-classified and auto-resolved by an AI agent via dedicated endpoints.
- **Report generation** — producing governance reports (PDF, CSV, XML, JSON) scoped to State or Electricity Board, stored on Cloudinary or S3.
- **Compliance / data retention** — configurable per-board/per-state retention policies driven by an automated cleanup job.
- **Full audit trail** — every administrative action is logged to `AuditLog` with user, entity, and metadata.

### Smart Meter / Electricity Board Context

India's electricity distribution is hierarchically organised:

```
State  →  ElectricityBoard  →  Consumer  →  SmartMeter
```

A **State** may have multiple **Electricity Boards** (DISCOMs). Each board manages its own consumers, meters, tariffs, and report formats. Administrative users (admins) are scoped to either a state or a board, ensuring strict data isolation through the `buildScopeFilter()` helper.

### Key Architectural Decisions

| Decision                                  | Rationale                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Clerk for auth**                        | Offloads OTP/phone login complexity; JWT verified server-side via `@clerk/express`                  |
| **Prisma ORM**                            | Type-safe database queries with migration support; generated client lives in `src/generated/prisma` |
| **Service → Controller → Route layering** | Separates business logic from HTTP concerns; controllers are thin wrappers                          |
| **RBAC via permission map**               | Fine-grained, declarative permissions rather than role-string checks scattered across code          |
| **`buildScopeFilter()`**                  | Single function enforces multi-tenant data isolation at the query level                             |
| **StorageProvider abstraction**           | Swap Cloudinary ↔ S3 via `STORAGE_PROVIDER` env variable without any service code changes           |
| **Centralized error hierarchy**           | `AppError` subclasses map cleanly to HTTP status codes; `mapPrismaError()` normalises DB exceptions |
| **Zod validation middleware**             | All untrusted inputs validated at the route boundary before reaching controllers                    |

---

## 2. System Architecture

The backend follows a strict **layered architecture**:

```
HTTP Request
    │
    ▼
[ Express Global Middleware ]
    ├── express.json()           ← body parsing
    └── clerkMiddleware()        ← JWT parsing (sets auth context)
    │
    ▼
[ Route-Level Middleware Chain ]
    ├── requireAuth              ← enforces valid Clerk session
    ├── resolveAppUser()         ← hydrates req.appUser from DB
    │   OR resolveConsumer()     ← hydrates req.appConsumer from DB
    ├── checkPermission(...)     ← RBAC gate
    └── validate({ body/params/query }) ← Zod schema validation
    │
    ▼
[ Controller ]
    └── calls Service method, returns structured ApiResponse
    │
    ▼
[ Service ]
    ├── Business logic + Prisma queries
    ├── buildScopeFilter()       ← multi-tenant WHERE clause
    ├── logAudit()               ← writes AuditLog
    └── getStorage()             ← upload/delete/signed URL
    │
    ▼
[ Prisma Client (singleton) ]
    └── PostgreSQL
    │
    ▼
[ Global Error Handler ]
    └── normalises AppError / ValidationError / unknown → JSON
```

---

## 3. Mermaid Diagrams

### A) Overall Backend Architecture

```mermaid
flowchart TD
    Client(["Client (Expo / Web / AI Agent)"])

    Client --> |"HTTP + Clerk JWT"| MW["Global Middleware\nclerkMiddleware · express.json()"]
    MW --> Routes["Route Layer\nrequireAuth · resolveAppUser/Consumer\ncheckPermission · validate()"]
    Routes --> Controllers["Controllers\nThin HTTP wrappers"]
    Controllers --> Services["Services\nBusiness Logic"]
    Services --> Prisma[("Prisma ORM\nPostgreSQL")]
    Services --> Storage["StorageProvider\nCloudinary / S3"]
    Services --> Audit["Audit Logging\nAuditLog table"]
    Routes --> ErrHandler["Global Error Handler\nAppError → JSON"]
```

---

### B) Module Interaction Diagram

```mermaid
flowchart LR
    subgraph Core
        SM["SmartMeter"]
        CN["Consumer"]
        BR["BillingReport"]
        QR["CustomerQuery"]
        NT["Notification"]
    end

    subgraph Infrastructure
        REP["Report Generation\n(ReportFormat + GeneratedReportFile)"]
        AUD["Audit Logging"]
        USR["User / Admin\nManagement"]
        REF["Reference Data\n(State + ElectricityBoard)"]
        RET["Data Retention"]
    end

    subgraph Shared
        PRI[("Prisma Client")]
        STO["StorageProvider"]
        CLK["Clerk Auth Middleware"]
        SCF["buildScopeFilter()"]
        ZOD["Zod Validators"]
    end

    REF --> USR
    REF --> CN
    REF --> SM
    CN --> SM
    SM --> BR
    BR --> QR
    CN --> NT
    CN --> QR

    Core --> PRI
    Infrastructure --> PRI
    REP --> STO
    Core --> AUD
    Infrastructure --> AUD
    Core --> SCF
    Infrastructure --> SCF
    CLK --> USR
    CLK --> CN
    ZOD --> Core
    ZOD --> Infrastructure
```

---

### C) Authentication + RBAC Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant CK as Clerk (external)
    participant MW as Auth Middleware
    participant DB as PostgreSQL
    participant RT as Route Handler

    C->>CK: Phone OTP login
    CK-->>C: Signed JWT (session token)

    C->>MW: HTTP Request + Bearer JWT
    MW->>CK: Verify JWT (clerkMiddleware)
    CK-->>MW: userId (clerkUserId)

    alt Admin route
        MW->>DB: User.findUnique({ clerkUserId })
        DB-->>MW: { id, role, stateId, boardId }
        MW-->>RT: req.appUser populated
        RT->>RT: checkPermission(permission)
        Note over RT: ROLE_PERMISSIONS[role].includes(permission)
    else Consumer route
        MW->>DB: Consumer.findUnique({ clerkUserId })
        DB-->>MW: { id, stateId, boardId }
        MW-->>RT: req.appConsumer populated
    end

    RT-->>C: 200 OK / 401 / 403
```

---

### D) Report Generation Pipeline

```mermaid
flowchart TD
    User["Admin User\n(REPORT_GENERATE permission)"]
    User -->|POST /api/reports/generate| RC["reportController.generate()"]
    RC --> RS["reportService.generateReport()"]
    RS --> SF["buildScopeFilter()\nscope: state / board"]
    RS --> DB[("PostgreSQL\nquery billing / meter data")]
    RS --> BUILD["Build report payload\n(JSON / CSV / XML / PDF)"]
    BUILD --> STORE["getStorage()\nCloudinary or S3"]
    STORE --> URL["Signed / Public URL returned"]
    URL --> GFROW["GeneratedReportFile row\nsaved to DB (boardId, stateId, fileUrl, format)"]
    GFROW --> LOG["AuditLog entry"]
    GFROW --> RES["201 response with fileUrl"]
```

---

### E) Data Retention / Compliance Flow

```mermaid
flowchart TD
    Trigger["POST /api/retention/cleanup/run\n(AUDIT_READ permission)"]
    Trigger --> RS["retentionService.runCleanup()"]
    RS --> FP["Fetch all DataRetentionPolicies\n(scoped by stateId / boardId)"]
    FP --> LOOP["For each policy"]
    LOOP --> CALC["Calculate cutoff date\nnow() − retentionDays"]
    CALC --> DEL["Prisma deleteMany()\nentityType WHERE createdAt < cutoff"]
    DEL --> LOG["AuditLog — records purged"]
    LOG --> RES["200 summary response\n{ deleted: N }"]
```

---

## 4. Folder Structure

```
smartMettr/
├── src/
│   ├── index.ts                  ← App entry point: registers all routes & middleware
│   │
│   ├── prisma/
│   │   ├── schema.prisma         ← Full data model (20+ models, enums)
│   │   ├── seed.ts               ← Development seed script
│   │   └── migrations/           ← Prisma migration history
│   │
│   ├── generated/
│   │   └── prisma/               ← Auto-generated Prisma client (do not edit manually)
│   │
│   ├── middleware/
│   │   ├── auth.ts               ← Clerk integration, AuthUser/AuthConsumer interfaces,
│   │   │                           Permission map, ROLE_PERMISSIONS matrix,
│   │   │                           requireAuth, resolveAppUser(), resolveConsumer(),
│   │   │                           checkPermission(), checkAnyPermission()
│   │   ├── errorHandler.ts       ← Global Express error handler (AppError → JSON)
│   │   └── validate.middleware.ts← Zod validation middleware (body / params / query)
│   │
│   ├── lib/
│   │   ├── prisma.ts             ← Prisma client singleton
│   │   ├── errors.ts             ← AppError hierarchy + mapPrismaError()
│   │   ├── apiResponse.ts        ← Shared ApiResponse type { success, data?, error? }
│   │   └── storage/
│   │       ├── storage.interface.ts ← StorageProvider interface (upload, delete, getSignedUrl)
│   │       ├── index.ts             ← getStorage() factory — lazy init, env-driven
│   │       ├── cloudinary.storage.ts← Cloudinary implementation
│   │       └── s3.storage.ts        ← AWS S3 implementation
│   │
│   ├── validators/
│   │   ├── user.schema.ts        ← createUser, updateRole, updateScope, updateConsent schemas
│   │   ├── report.schema.ts      ← reportGenerate, reportFormat schemas
│   │   ├── query.schema.ts       ← createQuery, updateQueryStatus, aiClassify schemas
│   │   └── retention.schema.ts   ← createRetentionPolicy, updateRetentionPolicy schemas
│   │
│   ├── helper/
│   │   ├── service.helper.ts     ← buildScopeFilter(user) — multi-tenant Prisma WHERE builder
│   │   └── controller.helper.ts  ← Shared controller utilities (sendSuccess, etc.)
│   │
│   ├── controllers/              ← HTTP layer: parse req, call service, return res
│   │   ├── smartMeter.controller.ts
│   │   ├── consumer.controller.ts
│   │   ├── billingReport.controller.ts
│   │   ├── query.controller.ts
│   │   ├── notification.controller.ts
│   │   ├── report.controller.ts
│   │   ├── audit.controller.ts
│   │   ├── user.controller.ts
│   │   ├── reference.controller.ts
│   │   └── retention.controller.ts
│   │
│   ├── services/                 ← Business logic, Prisma queries, storage, audit calls
│   │   ├── smartMeter.service.ts
│   │   ├── consumer.service.ts
│   │   ├── billingReport.service.ts
│   │   ├── query.service.ts
│   │   ├── notification.service.ts
│   │   ├── report.service.ts
│   │   ├── audit.service.ts
│   │   ├── user.service.ts
│   │   ├── reference.service.ts
│   │   └── retention.service.ts
│   │
│   └── routes/                   ← Route definitions with inline middleware chains
│       ├── smartMeter.routes.ts
│       ├── consumer.routes.ts
│       ├── billingReport.routes.ts
│       ├── query.routes.ts
│       ├── notification.routes.ts
│       ├── report.routes.ts
│       ├── audit.routes.ts
│       ├── user.routes.ts
│       ├── reference.routes.ts
│       └── retention.routes.ts
│
├── .env                          ← Local secrets (not committed)
├── .env.example                  ← Template of required environment variables
├── package.json                  ← pnpm project config (ESM, tsx dev, tsc build)
├── tsconfig.json                 ← TypeScript configuration
└── prisma.config.ts              ← Prisma config entrypoint
```

### Directory Roles Explained

| Directory      | Role                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `middleware/`  | Express middleware factories — auth, validation, error handling. These are the gates every request must pass through before reaching a controller.                                  |
| `lib/`         | Pure infrastructure: singleton Prisma client, error classes, API response type, and the storage abstraction. Code here has no business logic.                                       |
| `validators/`  | Zod schema definitions. One file per domain. Each schema exports an inferred TypeScript type (e.g. `CreateUserInput`).                                                              |
| `helper/`      | Small utility functions shared across the service layer. `buildScopeFilter()` is the most important — it constructs the Prisma `where` clause that enforces multi-tenancy.          |
| `controllers/` | Thin HTTP adapters. They extract data from `req`, call the appropriate service method, and return a formatted `ApiResponse`. No business logic lives here.                          |
| `services/`    | All business logic is here. Services interact with Prisma, call `getStorage()`, emit audit logs, and throw `AppError` subclasses on failure.                                        |
| `routes/`      | Mount controllers behind their middleware chains. Route files are the single place where authentication, RBAC, and validation middleware are wired to individual endpoint handlers. |

---

## 5. Authentication & RBAC

### Clerk Login Flow

SmartMettr delegates authentication entirely to **Clerk**. The login flow uses **phone number + OTP**.

```
1. User opens mobile app (Expo) or web client.
2. Clerk SDK sends OTP to phone number.
3. User enters OTP → Clerk issues a signed JWT session token.
4. Client attaches JWT to every API request (Authorization: Bearer <token> or cookie).
5. Server-side: clerkMiddleware() validates the JWT and populates the Clerk auth context.
```

### User / Consumer Dual Entity Model

The system maintains **two separate identity types**:

| Type                 | Table      | Middleware          | Use case                                                     |
| -------------------- | ---------- | ------------------- | ------------------------------------------------------------ |
| **Admin/Staff User** | `User`     | `resolveAppUser()`  | Admins, support agents, auditors with role-based permissions |
| **Consumer**         | `Consumer` | `resolveConsumer()` | Electricity consumers accessing self-service endpoints       |

Both entity types store `clerkUserId` as a unique foreign key, linking the Clerk identity to the local database record.

`ExternalAuth` table records the provider + providerUserId alongside optional `userId` and `consumerId`, supporting future multi-provider scenarios.

### Middleware Chain

Every protected route follows this chain:

```typescript
router.verb(
  "/path",
  requireAuth, // enforces a valid Clerk session (401 if missing)
  resolveAppUser(), // DB lookup → req.appUser (403 if not in system)
  checkPermission(Permission.SOME_PERMISSION), // RBAC check (403 if denied)
  validate({ body: someSchema }), // Zod validation (400 if invalid)
  controller.method,
);
```

### Role Permission Matrix

| Permission            | SUPER_ADMIN | STATE_ADMIN | BOARD_ADMIN | SUPPORT_AGENT | AUDITOR |
| --------------------- | :---------: | :---------: | :---------: | :-----------: | :-----: |
| `meter:create`        |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `meter:read`          |     ✅      |     ✅      |     ✅      |      ✅       |   ✅    |
| `meter:update`        |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `meter:assign`        |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `meter:delete`        |     ✅      |     ❌      |     ❌      |      ❌       |   ❌    |
| `consumer:create`     |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `consumer:read`       |     ✅      |     ✅      |     ✅      |      ✅       |   ✅    |
| `consumer:update`     |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `consumer:delete`     |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `billing:read`        |     ✅      |     ✅      |     ✅      |      ✅       |   ✅    |
| `billing:generate`    |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `billing:recalculate` |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `report:generate`     |     ✅      |     ✅      |     ✅      |      ❌       |   ❌    |
| `query:manage`        |     ✅      |     ✅      |     ✅      |      ✅       |   ❌    |
| `notification:manage` |     ✅      |     ✅      |     ✅      |      ✅       |   ❌    |
| `audit:read`          |     ✅      |     ✅      |     ❌      |      ❌       |   ✅    |
| `user:manage`         |     ✅      |     ✅      |     ❌      |      ❌       |   ❌    |

### Scope Filtering (`buildScopeFilter`)

`buildScopeFilter(user: AuthUser)` enforces **multi-tenant data isolation** at the Prisma query level:

```
SUPER_ADMIN  → no filter (sees all data across all states/boards)
STATE_ADMIN  → { stateId: user.stateId }
BOARD_ADMIN  → { boardId: user.boardId }
SUPPORT_AGENT / AUDITOR → boardId (if set) otherwise stateId
```

Every `list` and `getAll` service method passes this filter to `prisma.entity.findMany({ where: { ...scopeFilter, ...otherFilters } })`.

---

## 6. Storage Abstraction

### Overview

The `StorageProvider` interface abstracts cloud storage behind three operations:

```typescript
interface StorageProvider {
  upload(
    buffer: Buffer,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
  getSignedUrl?(key: string, expiresIn?: number): Promise<string>; // optional
}
```

### Provider Selection

Storage is configured via the `STORAGE_PROVIDER` environment variable:

| Value                  | Provider                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| `cloudinary` (default) | `CloudinaryStorage` — uses `cloudinary` npm SDK                           |
| `s3`                   | `S3Storage` — uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |

The `getStorage()` factory uses **lazy initialisation** and **dynamic imports** so that only the selected provider's SDK is bundled and loaded at runtime.

```typescript
// lib/storage/index.ts
export async function getStorage(): Promise<StorageProvider> {
  if (_provider) return _provider;
  if (process.env["STORAGE_PROVIDER"] === "s3") {
    const { S3Storage } = await import("./s3.storage.js");
    _provider = new S3Storage();
  } else {
    const { CloudinaryStorage } = await import("./cloudinary.storage.js");
    _provider = new CloudinaryStorage();
  }
  return _provider;
}
```

### Signed URL Strategy

- **Cloudinary**: returns a public or signed URL on upload. No additional step needed for read access.
- **S3**: uses `getSignedUrl` from `@aws-sdk/s3-request-presigner` to generate time-limited presigned URLs for secure, direct-to-bucket downloads.

In the report service, after uploading a file, the `fileUrl` stored in `GeneratedReportFile` is the permanent object key/URL. The `download` endpoint generates a fresh signed URL on each request.

### Switching Providers

No application code changes are needed. Simply update the environment variable:

```bash
STORAGE_PROVIDER=s3      # switch to AWS S3
STORAGE_PROVIDER=cloudinary  # switch back to Cloudinary (or omit the variable)
```

---

## 7. System Hardening Layer

### Zod Validation Strategy

All incoming request data is validated using **Zod** before reaching controllers.

The `validate()` middleware in `middleware/validate.middleware.ts` accepts a `ValidationSchemas` object with optional `body`, `params`, and `query` Zod schemas. On parse failure, it throws a `BadRequestError` with a human-readable message listing all failing fields and their error messages.

On success, raw `req.body`, `req.params`, and `req.query` are **replaced** with the Zod-parsed (coerced and stripped) values, ensuring controllers always receive clean, typed data.

**Schema locations:**

| File                             | Schemas                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `validators/user.schema.ts`      | `createUserSchema`, `updateRoleSchema`, `updateScopeSchema`, `updateConsentSchema`, `idParamSchema` |
| `validators/report.schema.ts`    | Report generation and format creation schemas                                                       |
| `validators/query.schema.ts`     | Query creation, status update, and AI classification schemas                                        |
| `validators/retention.schema.ts` | Retention policy create / update schemas                                                            |

All schemas use `.strict()` where appropriate to reject unknown fields.

### Centralized Audit Logging

Every significant write operation in the service layer emits an `AuditLog` record:

```
{ userId, action, entity, entityId, metadata, createdAt }
```

The audit service exposes:

- `list()` — paginated, filterable audit log retrieval.
- `getById()` — single log entry.
- `exportCSV()` — full audit log export (restricted to `audit:read` permission; serves `SUPER_ADMIN` and `STATE_ADMIN`/`AUDITOR`).

### Error Normalization

A typed `AppError` hierarchy ensures every error maps to an unambiguous HTTP status:

| Class               | Status       | Use case                                                |
| ------------------- | ------------ | ------------------------------------------------------- |
| `AppError`          | configurable | Base class                                              |
| `BadRequestError`   | 400          | Malformed input, business rule violations               |
| `UnauthorizedError` | 401          | Missing or invalid Clerk session                        |
| `ForbiddenError`    | 403          | Authenticated but insufficient permissions              |
| `NotFoundError`     | 404          | Entity doesn't exist                                    |
| `ConflictError`     | 409          | Unique constraint violations                            |
| `ValidationError`   | 422          | Field-level validation failures (includes `fields` map) |

`mapPrismaError(error)` normalises Prisma known error codes (`P2002`, `P2025`, `P2003`, `P2014`) into the appropriate `AppError` subclass so database errors never leak raw Prisma messages to clients.

The `globalErrorHandler` is registered **last** in the Express app. It:

1. Handles `ValidationError` with field details in the response body.
2. Handles all other `AppError` subclasses with the correct HTTP status.
3. For unknown programmer errors: logs to `console.error` and returns a generic `500` (message hidden in `production`).

### Security Considerations

- **No secret leakage in production** — `globalErrorHandler` returns `"Internal server error"` instead of stack traces when `NODE_ENV=production`.
- **Strict schema validation** — `.strict()` schemas reject unexpected fields, preventing mass-assignment attacks.
- **Scoped data access** — `buildScopeFilter()` ensures no role (other than `SUPER_ADMIN`) can list or modify data outside its assigned state/board.
- **Clerk JWT verification** — session tokens are verified cryptographically on every request; no password storage in the backend.
- **Minimal DB exposure** — Prisma `select` clauses limit which columns are returned from sensitive lookups (e.g., `resolveAppUser` only selects `id, clerkUserId, role, stateId, boardId`).
- **Consent model** — `CustomerConsent` and `UserConsent` tables track GDPR-style consent for `ENERGY_TRACKING` and `AI_QUERY_PROCESSING`, with granted/revoked timestamps.

---

## 8. API Module Summary

| Module            | Base Path            | Purpose                                        | Key Endpoints                                                                                                                                                                                          |
| ----------------- | -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SmartMeter**    | `/api/smart-meters`  | Meter lifecycle management                     | `POST /` (create), `GET /:meterId`, `PATCH /:meterId/assign`, `PATCH /:meterId/status`, `GET /:meterId/consumption`, `GET /consumer/:consumerId`                                                       |
| **Consumer**      | `/api/consumers`     | Consumer registration, profiles, consents      | `POST /register`, `GET /me`, `PATCH /me`, `GET /me/consents`, `POST /me/consents/:type/grant`, `POST /me/consents/:type/revoke`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `GET /:id/consents` |
| **BillingReport** | `/api/billing`       | Billing generation, recalculation, aggregates  | `POST /generate`, `POST /aggregate`, `GET /`, `GET /:billId`, `POST /:billId/recalculate`, `GET /:billId/recalculations`, `POST /:billId/view`                                                         |
| **CustomerQuery** | `/api/queries`       | Consumer support queries + AI pipeline         | `POST /` (consumer), `GET /me` (consumer), `GET /`, `PATCH /:id/status`, `PATCH /:id/reply`, `DELETE /:id`, `GET /ai/pending`, `PATCH /:id/ai-classify`, `PATCH /:id/ai-resolve`, `GET /:id`           |
| **Notification**  | `/api/notifications` | Push/in-app notifications                      | `POST /` (admin), `GET /admin`, `DELETE /:id`, `GET /` (consumer), `PATCH /read-all`, `PATCH /:id/read`                                                                                                |
| **Report**        | `/api/reports`       | Report formats + file generation + download    | `POST /formats`, `GET /formats`, `POST /generate`, `GET /`, `GET /:id/download`, `DELETE /:id`                                                                                                         |
| **Audit**         | `/api/audit`         | Audit log retrieval and CSV export             | `GET /`, `GET /:id`, `GET /export/csv`                                                                                                                                                                 |
| **User**          | `/api/users`         | Admin user management, roles, scopes, consents | `POST /`, `GET /`, `GET /:id`, `PATCH /:id/role`, `PATCH /:id/scope`, `DELETE /:id`, `GET /:id/consents`, `PATCH /:id/consents`                                                                        |
| **Reference**     | `/api/reference`     | State and ElectricityBoard master data         | `POST /states`, `GET /states`, `POST /boards`, `GET /boards`, `GET /boards/:id`, `PATCH /boards/:id`, `DELETE /boards/:id`                                                                             |
| **Retention**     | `/api/retention`     | Data retention policy management + cleanup     | `POST /`, `GET /`, `PATCH /:id`, `DELETE /:id`, `POST /cleanup/run`                                                                                                                                    |

**Health Check:** `GET /health` — returns `{ status: "ok", timestamp }`. Requires no authentication.

---

## 9. Deployment Considerations

### Environment Variables

Copy `.env.example` to `.env` and fill in all values before starting the server.

```env
# ── Clerk Authentication ──────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_...          # Server-side Clerk secret
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...  # Client-facing publishable key

# ── Application ───────────────────────────────────────────────────
NODE_ENV=production                   # or 'development'
PORT=3000                             # default 3000

# ── Database ──────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/smartmettr

# ── Storage (choose one provider) ─────────────────────────────────
STORAGE_PROVIDER=cloudinary           # 'cloudinary' or 's3'

# Cloudinary (if STORAGE_PROVIDER=cloudinary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AWS S3 (if STORAGE_PROVIDER=s3)
AWS_REGION=ap-south-1
S3_BUCKET=your-bucket-name
# AWS credentials should be via IAM role (ECS/EC2) or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
```

### Database Setup

```bash
# Install dependencies
pnpm install

# Apply migrations
pnpm exec prisma migrate deploy

# Seed development data (optional)
pnpm exec prisma db seed

# Generate Prisma client (done automatically on install if postinstall script is set)
pnpm exec prisma generate
```

### Running the Server

```bash
# Development (hot reload via tsx)
pnpm dev

# Production
pnpm build   # compiles TypeScript to dist/
pnpm start   # runs dist/index.js with Node
```

### Storage Configuration

- **Cloudinary**: Ensure the cloud account and API credentials are set. Upload preset or folder can be passed via `options` in `upload()`.
- **AWS S3**: Attach an IAM role to the compute instance with minimum permissions: `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject`. Use presigned URLs for secure downloads rather than public bucket access.

### Security Notes

- Set `NODE_ENV=production` in all production environments to suppress error details.
- Place the API behind an HTTPS-terminating reverse proxy (nginx, AWS ALB, Cloud Run, etc.).
- Use Clerk's production instance (not development) with hardened rate-limiting on the OTP endpoint.
- Restrict database access to the backend service's IP/security group only.
- Rotate `CLERK_SECRET_KEY` and storage credentials on a schedule.
- Enable PostgreSQL row-level security (RLS) as an additional boundary if deploying as a shared cluster.
- Review and tighten S3 bucket policy — `BlockPublicAcls` should be `true`; rely only on presigned URLs.

---

## 10. Future Improvements

### IoT Ingestion Scaling

Current meter reading ingestion is synchronous. As the number of smart meters grows, introduce:

- **Message queue** (AWS SQS / RabbitMQ / Kafka) to buffer incoming IoT telemetry.
- **Worker service** to consume readings, persist `MeterReading` rows, and trigger aggregate rebuilds asynchronously.
- **Batch aggregation jobs** (cron or Step Functions) for `ConsumptionAggregate` rollups (HOURLY → DAILY → MONTHLY).

### Monitoring & Observability

- Integrate **OpenTelemetry** for distributed tracing across Express routes, Prisma queries, and storage operations.
- Ship structured JSON logs to **Datadog**, **Grafana Loki**, or **AWS CloudWatch**.
- Add **Prometheus** metrics endpoint (`/metrics`) for latency histograms, error rates, and queue depth.
- Set up **Sentry** for real-time error alerting on unhandled exceptions.

### Queue System for Notifications

Replace synchronous notification creation with an event-driven model:

- Emit events (billing generated, query resolved) to a queue.
- Notification worker consumes events and sends push notifications (FCM/APNs) via Expo Push API.
- Outbox pattern ensures at-least-once delivery even under transient failures.

### Frontend Expo Integration

- The backend already sets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, which is compatible with Clerk's React Native / Expo SDK.
- Implement **signed URL pre-fetching** for bill downloads via the `GET /:id/download` endpoint.
- Add WebSocket or **Server-Sent Events** channel for real-time notification delivery without polling.

### Additional Hardening

- **API rate limiting** via `express-rate-limit` per-user / per-IP on sensitive endpoints (OTP, query creation, billing generation).
- **Idempotency keys** on billing generation and report generation endpoints to prevent duplicate records on client retries.
- **Soft deletes** (`deletedAt` timestamp) instead of hard deletes for audit compliance on `Consumer`, `User`, and `BillingReport` entities.
- **Schema versioning** for `ReportFormat.schema` (JSON) to handle format migrations gracefully.
- **CI/CD pipeline** with automated `prisma migrate deploy` on staging before promoting to production.
- **Database connection pooling** (PgBouncer or RDS Proxy) to handle high concurrent request volumes.
