# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the AutoCare+ monorepo with design tokens, local infra, a NestJS API skeleton (envelope, errors, config, health), the core Prisma schema, the Firebase→session auth spine (risk R-01), Next.js and two Expo app shells, and CI.

**Architecture:** pnpm + Turborepo monorepo. `apps/api` (NestJS 10, Prisma, Postgres, Redis), `apps/web` (Next.js 14 App Router + Tailwind), `apps/member` and `apps/field` (Expo SDK 51+, TypeScript). Shared `packages/`: `design-tokens`, `contracts` (Zod), `api-client`, `config`. The API is the only database client; clients authenticate with Firebase ID tokens exchanged at `POST /api/v1/auth/session`.

**Tech Stack:** TypeScript 5, Node 20 LTS, pnpm 9, Turborepo, NestJS 10, Prisma 5, Zod, firebase-admin, Next.js 14, Tailwind CSS 3, Expo (React Native), Vitest (packages/web), Jest (api), Docker Compose (Postgres 15, Redis 7).

## Global Constraints

- Node 20 LTS; TypeScript strict mode everywhere.
- Money is integer centavos; columns named `*_centavos`; never float (Data Model §8.4).
- All API responses use the envelope `{ success, data, meta, error }`; errors carry stable machine codes (API Spec §9.1, §9.12).
- Timestamps stored UTC; business dates computed in `Asia/Manila` (Architecture §7.10).
- Mobile clients never hold a Supabase key; the Supabase/Postgres connection string lives only in the API env (Architecture §7.3).
- Tokens on device go in Keychain/Keystore (`expo-secure-store`), never AsyncStorage (NFR-018).
- Text contrast WCAG AA: ≥4.5:1 body, ≥3:1 large text (NFR-028). Tap targets ≥48dp member app, ≥56dp field app (NFR-027).
- iOS-first: iOS 14+ is the QA target; Android must keep compiling (C-01).
- Schema changes only via checked-in Prisma migrations (NFR-044).

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`

**Interfaces:**
- Produces: workspace layout `apps/*`, `packages/*`; shared `tsconfig.base.json` extended by every package as `@autocare/config/tsconfig.base.json`; turbo tasks `build`, `test`, `typecheck`, `lint`.

- [ ] **Step 1: Write root manifests**

`package.json`:
```json
{
  "name": "autocare",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20 <21" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  },
  "devDependencies": { "turbo": "^2.1.0", "typescript": "^5.5.0" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": {},
    "lint": {}
  }
}
```

`.nvmrc`: `20`

`.gitignore`: `node_modules`, `dist`, `.next`, `.expo`, `.env`, `*.tsbuildinfo`, `coverage`, `.turbo`, `.DS_Store`

- [ ] **Step 2: Create packages/config**

`packages/config/package.json`:
```json
{ "name": "@autocare/config", "version": "0.0.1", "private": true, "files": ["tsconfig.base.json"] }
```

`packages/config/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  }
}
```

- [ ] **Step 3: Verify install and task graph**

Run: `pnpm install && pnpm turbo run typecheck --dry-run`
Expected: install succeeds; dry-run lists no tasks yet (no packages define typecheck) with exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

### Task 2: Design tokens package

**Files:**
- Create: `packages/design-tokens/package.json`, `src/tokens.ts`, `src/tailwind-preset.ts`, `src/css-vars.ts`, `src/index.ts`, `tsconfig.json`, `vitest.config.ts`
- Test: `packages/design-tokens/src/tokens.test.ts`

**Interfaces:**
- Produces: `import { colors, vhsBands, typeScale, spacing, radii, targets, fontStacks } from "@autocare/design-tokens"`; `tailwindPreset` (a Tailwind `Partial<Config>`); `toCssVars(): string`.
- `vhsBands` is keyed `EXCELLENT | GOOD | FAIR | NEEDS_ATTENTION | CRITICAL` matching the `ScoreResult.band` type (VHS Algorithm §11.10) — these are product data colors, immutable without design review.

- [ ] **Step 1: Write the failing contrast test**

`src/tokens.test.ts` (Vitest):
```typescript
import { describe, expect, it } from "vitest";
import { colors, vhsBands, targets, contrastRatio } from "./tokens";

describe("design tokens", () => {
  it("body text on surfaces meets WCAG AA 4.5:1 (NFR-028)", () => {
    expect(contrastRatio(colors.ink, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.ink, colors.chassis)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.inkMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
  it("every VHS band chip passes 3:1 for large text/graphics", () => {
    for (const band of Object.values(vhsBands)) {
      expect(contrastRatio(band.on, band.fill)).toBeGreaterThanOrEqual(3);
    }
  });
  it("field targets exceed member targets (NFR-027)", () => {
    expect(targets.fieldMinDp).toBeGreaterThanOrEqual(56);
    expect(targets.memberMinDp).toBeGreaterThanOrEqual(48);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/design-tokens test`
Expected: FAIL — `./tokens` has no exports.

- [ ] **Step 3: Implement tokens**

`src/tokens.ts`:
```typescript
/** AutoCare+ "workshop precision" token set. Values are the source of truth
 *  for RN StyleSheets, the Tailwind preset, and public-page CSS vars. */

export const colors = {
  ink: "#16232E",        // primary text — deep steel blue-black
  inkMuted: "#51616F",   // secondary text
  chassis: "#EEF1F3",    // app background — cool workshop grey (never cream)
  surface: "#FFFFFF",    // cards, sheets
  line: "#D5DBE0",       // hairline borders
  primary: "#0E5AA7",    // Gauge Blue — actions, links, focus
  primaryDeep: "#0A2E4F",// headers, field-app chrome, certificate footer
  onPrimary: "#FFFFFF",
  danger: "#C2372C",     // destructive actions (distinct from CRITICAL band use)
  success: "#177245",    // confirmations
} as const;

/** Score bands per VHS Algorithm §11.5. `fill` is the chip/arc color,
 *  `on` the text color placed on it, `text` the color used on light surfaces. */
export const vhsBands = {
  EXCELLENT:       { min: 90, fill: "#177245", on: "#FFFFFF", text: "#0F5C37", labelEn: "Excellent", labelFil: "Napakaayos" },
  GOOD:            { min: 75, fill: "#5C9E31", on: "#FFFFFF", text: "#3F7420", labelEn: "Good", labelFil: "Maayos" },
  FAIR:            { min: 60, fill: "#C88A00", on: "#FFFFFF", text: "#8A5F00", labelEn: "Fair", labelFil: "Katamtaman" },
  NEEDS_ATTENTION: { min: 40, fill: "#C75E1B", on: "#FFFFFF", text: "#9C4204", labelEn: "Needs Attention", labelFil: "Kailangan ng Aksyon" },
  CRITICAL:        { min: 0,  fill: "#B3261E", on: "#FFFFFF", text: "#8F1D17", labelEn: "Critical", labelFil: "Delikado" },
} as const;

export const fontStacks = {
  display: `"Barlow Semi Condensed", "SF Pro Display", system-ui, sans-serif`, // score numerals, headings
  body: `"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif`,
  mono: `"IBM Plex Mono", ui-monospace, Menlo, monospace`, // plates, VINs, receipt & verification codes
} as const;

/** rem-based scale; RN multiplies by 16. Field app uses one step larger per role. */
export const typeScale = {
  score: { size: 4.5, weight: 600, family: "display" },   // the 0–100 numeral
  h1: { size: 1.75, weight: 600, family: "display" },
  h2: { size: 1.375, weight: 600, family: "display" },
  body: { size: 1, weight: 400, family: "body" },
  label: { size: 0.8125, weight: 500, family: "body" },
  code: { size: 0.9375, weight: 500, family: "mono" },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 6, md: 12, pill: 999 } as const;
export const targets = { memberMinDp: 48, fieldMinDp: 56 } as const;

export function bandForScore(score: number) {
  for (const [key, b] of Object.entries(vhsBands)) if (score >= b.min) return key as keyof typeof vhsBands;
  return "CRITICAL";
}

/** WCAG 2.x relative-luminance contrast ratio. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const chan = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
  };
  const [a, b] = [lum(hexA), lum(hexB)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

`src/tailwind-preset.ts`:
```typescript
import { colors, vhsBands, fontStacks, radii } from "./tokens";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink, "ink-muted": colors.inkMuted, chassis: colors.chassis,
        surface: colors.surface, line: colors.line, primary: colors.primary,
        "primary-deep": colors.primaryDeep, danger: colors.danger, success: colors.success,
        band: Object.fromEntries(Object.entries(vhsBands).map(([k, v]) => [k.toLowerCase().replace("_", "-"), v.fill])),
      },
      fontFamily: { display: fontStacks.display.split(","), body: fontStacks.body.split(","), mono: fontStacks.mono.split(",") },
      borderRadius: { sm: `${radii.sm}px`, md: `${radii.md}px` },
    },
  },
};
```

`src/css-vars.ts`:
```typescript
import { colors, vhsBands } from "./tokens";
export function toCssVars(): string {
  const base = Object.entries(colors).map(([k, v]) => `--ac-${k}: ${v};`);
  const bands = Object.entries(vhsBands).map(([k, v]) => `--ac-band-${k.toLowerCase()}: ${v.fill};`);
  return `:root {\n  ${[...base, ...bands].join("\n  ")}\n}`;
}
```

`src/index.ts`:
```typescript
export * from "./tokens";
export { tailwindPreset } from "./tailwind-preset";
export { toCssVars } from "./css-vars";
```

`package.json`:
```json
{
  "name": "@autocare/design-tokens",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "devDependencies": { "vitest": "^2.0.0", "typescript": "^5.5.0" }
}
```

`tsconfig.json`: `{ "extends": "@autocare/config/tsconfig.base.json", "include": ["src"] }` — same pattern for every later package; not repeated below.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @autocare/design-tokens test`
Expected: PASS (3 tests). If a contrast assertion fails, darken the failing foreground until it passes — do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens && git commit -m "feat: design tokens with WCAG contrast tests"
```

---

### Task 3: Contracts package (envelope + error codes)

**Files:**
- Create: `packages/contracts/package.json`, `src/envelope.ts`, `src/errors.ts`, `src/auth.ts`, `src/index.ts`
- Test: `packages/contracts/src/envelope.test.ts`

**Interfaces:**
- Produces: `envelopeSchema(dataSchema)` → Zod schema for `{ success, data, meta, error }`; `ErrorCode` union (the 20 codes of API Spec §9.12); `sessionResponseSchema`, `SessionResponse` = `{ user: { id, firebaseUid, name, mobile, email, role } }`; `Role` = `"MEMBER" | "FLEET_MANAGER" | "MECHANIC" | "ADVISOR" | "DRIVER" | "ADMIN"`.

- [ ] **Step 1: Write the failing test**

`src/envelope.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { envelopeSchema, errorCodes } from "./index";

describe("contracts", () => {
  it("parses a success envelope", () => {
    const schema = envelopeSchema(z.object({ ok: z.boolean() }));
    const parsed = schema.parse({ success: true, data: { ok: true }, meta: null, error: null });
    expect(parsed.data?.ok).toBe(true);
  });
  it("rejects success=true with an error body", () => {
    const schema = envelopeSchema(z.object({}));
    expect(() => schema.parse({ success: true, data: {}, meta: null, error: { code: "RATE_LIMITED", message: "x" } })).toThrow();
  });
  it("contains all documented error codes", () => {
    expect(errorCodes).toContain("AUTH_TOKEN_INVALID");
    expect(errorCodes).toContain("ODOMETER_REGRESSION");
    expect(errorCodes.length).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/contracts test` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/errors.ts`:
```typescript
export const errorCodes = [
  "AUTH_TOKEN_INVALID", "FORBIDDEN_ROLE", "CONSENT_REQUIRED", "PLATE_ALREADY_REGISTERED",
  "SLOT_UNAVAILABLE", "CAPACITY_EXCEEDED", "ENTITLEMENT_EXHAUSTED", "SUBSCRIPTION_LOCKED_IN",
  "SUBSCRIPTION_SUSPENDED", "ROADSIDE_NOT_ELIGIBLE", "OUT_OF_SERVICE_ZONE", "INSPECTION_INCOMPLETE",
  "INSPECTION_IMMUTABLE", "NOT_CERTIFIED_TECHNICIAN", "ODOMETER_REGRESSION", "APPROVAL_REQUIRED",
  "CERTIFICATE_REVOKED", "PAYMENT_FAILED", "DUPLICATE_REQUEST", "RATE_LIMITED",
] as const;
export type ErrorCode = (typeof errorCodes)[number];
```

`src/envelope.ts`:
```typescript
import { z } from "zod";
import { errorCodes } from "./errors";

const metaSchema = z.object({ page: z.number(), perPage: z.number(), total: z.number() }).nullable();
const errorBody = z.object({ code: z.enum(errorCodes), message: z.string(), details: z.unknown().optional() });

export function envelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data, meta: metaSchema, error: z.null() }),
    z.object({ success: z.literal(false), data: z.null(), meta: z.null(), error: errorBody }),
  ]);
}
export type Envelope<T> = { success: true; data: T; meta: { page: number; perPage: number; total: number } | null; error: null }
  | { success: false; data: null; meta: null; error: { code: (typeof errorCodes)[number]; message: string; details?: unknown } };
```

`src/auth.ts`:
```typescript
import { z } from "zod";
export const roles = ["MEMBER", "FLEET_MANAGER", "MECHANIC", "ADVISOR", "DRIVER", "ADMIN"] as const;
export type Role = (typeof roles)[number];
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(), firebaseUid: z.string(), name: z.string().nullable(),
    mobile: z.string().nullable(), email: z.string().nullable(), role: z.enum(roles),
  }),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
```

`src/index.ts` re-exports all three. `package.json` mirrors design-tokens (name `@autocare/contracts`, dep `zod ^3.23`).

- [ ] **Step 4: Run tests to verify they pass** → `pnpm --filter @autocare/contracts test` PASS.

- [ ] **Step 5: Commit** — `git add packages/contracts && git commit -m "feat: shared contracts — envelope, error codes, session"`

---

### Task 4: Local infrastructure (Docker Compose)

**Files:**
- Create: `docker-compose.yml`, `.env.example`

**Interfaces:**
- Produces: Postgres 15 on `localhost:5432` (db `autocare`, user `autocare`, password `autocare`), Redis 7 on `localhost:6379`. `DATABASE_URL=postgresql://autocare:autocare@localhost:5432/autocare`.

- [ ] **Step 1: Write compose file**

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment: { POSTGRES_USER: autocare, POSTGRES_PASSWORD: autocare, POSTGRES_DB: autocare }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U autocare"], interval: 5s, retries: 10 }
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes: { pgdata: }
```

`.env.example`:
```
DATABASE_URL=postgresql://autocare:autocare@localhost:5432/autocare
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=autocare-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@autocare-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
API_PORT=3001
```

- [ ] **Step 2: Verify services start**

Run: `docker compose up -d && docker compose exec postgres pg_isready -U autocare && docker compose exec redis redis-cli ping`
Expected: `accepting connections` and `PONG`.

- [ ] **Step 3: Commit** — `git add docker-compose.yml .env.example && git commit -m "chore: local Postgres + Redis via Docker Compose"`

---

### Task 5: NestJS API skeleton — config, envelope, errors, health

**Files:**
- Create: `apps/api/package.json`, `src/main.ts`, `src/app.module.ts`, `src/config/env.ts`, `src/common/interceptors/envelope.interceptor.ts`, `src/common/filters/global-exception.filter.ts`, `src/common/errors/domain-error.ts`, `src/modules/health/health.controller.ts`, `test/health.e2e-spec.ts`, `jest.config.js`, `nest-cli.json`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `ErrorCode` from `@autocare/contracts`.
- Produces: running API at `http://localhost:3001/api/v1`; `DomainError(code: ErrorCode, message: string, httpStatus: number)` — thrown by any later module, rendered into the envelope; `EnvelopeInterceptor` wraps all controller returns; env loaded via `loadEnv(): Env` (Zod-validated at boot, crashes on missing vars).

- [ ] **Step 1: Write the failing e2e test**

`test/health.e2e-spec.ts` (Jest + supertest):
```typescript
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("health (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(() => app.close());

  it("GET /api/v1/health returns enveloped ok", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" }, meta: null, error: null });
  });
  it("unknown route returns enveloped error with machine code", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/nope").expect(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.code).toBe("string");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test` → FAIL (AppModule missing).

- [ ] **Step 3: Implement skeleton**

`src/config/env.ts`:
```typescript
import { z } from "zod";
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  API_PORT: z.coerce.number().default(3001),
});
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (): Env => envSchema.parse(process.env);
```

`src/common/errors/domain-error.ts`:
```typescript
import type { ErrorCode } from "@autocare/contracts";
export class DomainError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly httpStatus: number) {
    super(message);
  }
}
```

`src/common/interceptors/envelope.interceptor.ts`:
```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map } from "rxjs/operators";
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => ({ success: true, data, meta: data?.__meta ?? null, error: null })));
  }
}
```

`src/common/filters/global-exception.filter.ts`:
```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { DomainError } from "../errors/domain-error";
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = 500, code = "INTERNAL", message = "Something went wrong";
    if (err instanceof DomainError) ({ httpStatus: status, code, message } = err);
    else if (err instanceof HttpException) { status = err.getStatus(); code = status === 404 ? "NOT_FOUND" : "HTTP_ERROR"; message = err.message; }
    res.status(status).json({ success: false, data: null, meta: null, error: { code, message } });
  }
}
```

`src/modules/health/health.controller.ts`:
```typescript
import { Controller, Get } from "@nestjs/common";
@Controller("health")
export class HealthController { @Get() get() { return { status: "ok" }; } }
```

`src/app.module.ts` registers `HealthController` and provides `APP_INTERCEPTOR`→`EnvelopeInterceptor`, `APP_FILTER`→`GlobalExceptionFilter`. `src/main.ts` calls `loadEnv()`, sets prefix `api/v1`, listens on `env.API_PORT`. `package.json` deps: `@nestjs/common@^10 @nestjs/core@^10 @nestjs/platform-express@^10 rxjs reflect-metadata zod @autocare/contracts`; dev: `jest supertest @nestjs/testing ts-jest`.

- [ ] **Step 4: Run tests to verify pass** — `pnpm --filter api test` → 2 PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(api): NestJS skeleton — envelope, domain errors, zod config, health"`

---

### Task 6: Core Prisma schema + migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `src/modules/prisma/prisma.service.ts`, `src/modules/prisma/prisma.module.ts`
- Test: `apps/api/test/prisma.e2e-spec.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from Task 4.
- Produces: Prisma models `User`, `ConsentRecord`, `Vehicle`, `OdometerReading` (Data Model §8.3 identity slice); global `PrismaModule` exporting injectable `PrismaService`. Later phases append models via new migrations — never edit applied ones.

- [ ] **Step 1: Write schema**

`prisma/schema.prisma` (excerpt of the four models — enums exactly as in contracts):
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { MEMBER FLEET_MANAGER MECHANIC ADVISOR DRIVER ADMIN }
enum UserStatus { ACTIVE SUSPENDED }
enum OdometerSource { MEMBER INSPECTION TRIP }

model User {
  id            String   @id @default(uuid()) @db.Uuid
  firebaseUid   String   @unique @map("firebase_uid")
  mobile        String?  @unique
  email         String?  @unique
  name          String?
  role          Role     @default(MEMBER)
  status        UserStatus @default(ACTIVE)
  isCertifiedTechnician Boolean @default(false) @map("is_certified_technician")
  createdAt     DateTime @default(now()) @map("created_at")
  consents      ConsentRecord[]
  vehicles      Vehicle[]
  @@map("users")
}

model ConsentRecord {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  user          User     @relation(fields: [userId], references: [id])
  policyVersion String   @map("policy_version")
  consentedAt   DateTime @default(now()) @map("consented_at")
  ip            String?
  withdrawnAt   DateTime? @map("withdrawn_at")
  @@map("consent_records")
}

model Vehicle {
  id           String  @id @default(uuid()) @db.Uuid
  ownerUserId  String? @map("owner_user_id") @db.Uuid
  owner        User?   @relation(fields: [ownerUserId], references: [id])
  plateNo      String  @unique @map("plate_no")
  make         String
  model        String
  year         Int
  variant      String?
  engineCc     Int?    @map("engine_cc")
  fuelType     String  @map("fuel_type")
  transmission String
  vin          String?
  color        String?
  currentOdometerKm Int @default(0) @map("current_odometer_km")
  status       String  @default("ACTIVE")
  createdAt    DateTime @default(now()) @map("created_at")
  odometerReadings OdometerReading[]
  @@index([ownerUserId, status])
  @@map("vehicles")
}

model OdometerReading {
  id         String   @id @default(uuid()) @db.Uuid
  vehicleId  String   @map("vehicle_id") @db.Uuid
  vehicle    Vehicle  @relation(fields: [vehicleId], references: [id])
  km         Int
  source     OdometerSource
  recordedAt DateTime @default(now()) @map("recorded_at")
  recordedBy String?  @map("recorded_by") @db.Uuid
  @@map("odometer_readings")
}
```

- [ ] **Step 2: Generate and migrate**

Run: `cd apps/api && pnpm prisma migrate dev --name init-identity-vehicles`
Expected: migration created and applied; client generated.

- [ ] **Step 3: Write round-trip test**

`test/prisma.e2e-spec.ts`:
```typescript
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("prisma (e2e)", () => {
  const prisma = new PrismaService();
  afterAll(async () => { await prisma.user.deleteMany({ where: { firebaseUid: "test-uid" } }); await prisma.$disconnect(); });

  it("creates and reads a user with a vehicle", async () => {
    const user = await prisma.user.create({
      data: { firebaseUid: "test-uid", role: "MEMBER", vehicles: { create: { plateNo: "ABC1234", make: "Toyota", model: "Vios", year: 2019, fuelType: "GASOLINE", transmission: "AT" } } },
      include: { vehicles: true },
    });
    expect(user.vehicles[0].plateNo).toBe("ABC1234");
  });
});
```

`PrismaService` extends `PrismaClient` with `onModuleInit` connect; `PrismaModule` is `@Global()`.

- [ ] **Step 4: Run tests** — `pnpm --filter api test` → PASS (requires compose up).

- [ ] **Step 5: Commit** — `git commit -m "feat(api): core Prisma schema — users, consent, vehicles, odometer"`

---

### Task 7: Auth spine — Firebase token → app session (risk R-01)

**Files:**
- Create: `apps/api/src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `firebase.service.ts`, `auth.guard.ts`, `current-user.decorator.ts`, `public.decorator.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 6), `loadEnv` (Task 5), `sessionResponseSchema` shape (Task 3).
- Produces: `POST /api/v1/auth/session` — body `{}`, header `Authorization: Bearer <firebase-id-token>` → `SessionResponse`; upserts user by `firebaseUid` on first sight. `AuthGuard` (global; `@Public()` opts out) attaches `req.user`; `@CurrentUser()` param decorator. `FirebaseService.verifyIdToken(token): Promise<{ uid: string; phone?: string; email?: string }>` — the ONLY Firebase coupling point (Architecture §7.3).

- [ ] **Step 1: Write the failing e2e test (firebase-admin mocked)**

`test/auth.e2e-spec.ts`:
```typescript
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";

describe("auth (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => { if (t !== "good-token") throw new Error("bad"); return { uid: "fb-123", phone: "+639170000000" }; } })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(() => app.close());

  it("exchanges a valid Firebase token for a session, creating the user", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session")
      .set("Authorization", "Bearer good-token").expect(201);
    expect(res.body.data.user.firebaseUid).toBe("fb-123");
    expect(res.body.data.user.role).toBe("MEMBER");
  });
  it("is idempotent — same uid returns same user id", async () => {
    const a = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer good-token");
    const b = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer good-token");
    expect(a.body.data.user.id).toBe(b.body.data.user.id);
  });
  it("rejects an invalid token with AUTH_TOKEN_INVALID", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session")
      .set("Authorization", "Bearer bad-token").expect(401);
    expect(res.body.error.code).toBe("AUTH_TOKEN_INVALID");
  });
  it("guards a protected route", async () => {
    await request(app.getHttpServer()).get("/api/v1/users/me").expect(401);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL (module missing).

- [ ] **Step 3: Implement**

`firebase.service.ts`:
```typescript
import { Injectable, OnModuleInit } from "@nestjs/common";
import * as admin from "firebase-admin";
import { loadEnv } from "../../config/env";

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    if (admin.apps.length) return;
    const env = loadEnv();
    admin.initializeApp({ credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })});
  }
  async verifyIdToken(token: string) {
    const d = await admin.auth().verifyIdToken(token);
    return { uid: d.uid, phone: d.phone_number, email: d.email };
  }
}
```

`auth.service.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FirebaseService } from "./firebase.service";
import { DomainError } from "../../common/errors/domain-error";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private firebase: FirebaseService) {}
  async createSession(bearer?: string) {
    const token = bearer?.replace(/^Bearer /, "");
    if (!token) throw new DomainError("AUTH_TOKEN_INVALID", "Missing bearer token", 401);
    let decoded;
    try { decoded = await this.firebase.verifyIdToken(token); }
    catch { throw new DomainError("AUTH_TOKEN_INVALID", "Token invalid or expired", 401); }
    const user = await this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {},
      create: { firebaseUid: decoded.uid, mobile: decoded.phone, email: decoded.email, role: "MEMBER" },
    });
    return { user: { id: user.id, firebaseUid: user.firebaseUid, name: user.name, mobile: user.mobile, email: user.email, role: user.role } };
  }
}
```

`auth.guard.ts` — global guard: reads `@Public()` metadata via `Reflector`; otherwise verifies bearer with `FirebaseService`, loads user by `firebaseUid`, throws `DomainError("AUTH_TOKEN_INVALID", …, 401)` if absent, assigns `req.user`. `auth.controller.ts` — `@Public() @Post("auth/session")` → `authService.createSession(req.headers.authorization)`. Add a minimal `@Get("users/me")` protected route returning `@CurrentUser()` to prove the guard (moves to UsersModule in Phase 1). Register guard via `APP_GUARD` in `AuthModule`; import into `AppModule`.

- [ ] **Step 4: Run tests** — all 4 PASS.

- [ ] **Step 5: Manual R-01 verification with real Firebase (dev project)**

Create a free Firebase project, enable Phone + Google providers, fill `.env`, run `pnpm --filter api start:dev`, obtain a real ID token via Firebase Auth REST (`signInWithPassword` on a test user) and curl `/api/v1/auth/session`. Expected: 201 with user JSON. This closes risk R-01 — record the outcome in the PR description.

- [ ] **Step 6: Commit** — `git commit -m "feat(api): Firebase auth spine — session exchange, global guard (closes R-01 spike)"`

---

### Task 8: API client package

**Files:**
- Create: `packages/api-client/package.json`, `src/client.ts`, `src/index.ts`
- Test: `packages/api-client/src/client.test.ts`

**Interfaces:**
- Consumes: `envelopeSchema`, `sessionResponseSchema`, `ErrorCode` from `@autocare/contracts`.
- Produces: `createApiClient({ baseUrl, getToken }): ApiClient`; `ApiClient.createSession(): Promise<SessionResponse>`; generic `get/post` that unwrap the envelope and throw `ApiError { code: ErrorCode | "NETWORK" | "INTERNAL"; message }` on failure. All three frontends use only this package for HTTP.

- [ ] **Step 1: Write the failing test**

`src/client.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiError } from "./client";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data, meta: null, error: null }) });
const err = (code: string, status = 402) => ({ ok: false, status, json: async () => ({ success: false, data: null, meta: null, error: { code, message: "nope" } }) });

describe("api client", () => {
  it("attaches bearer token and unwraps envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ user: { id: "u1" } }));
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "tok", fetchImpl: fetchMock as any });
    const out = await api.post<{ user: { id: string } }>("/auth/session");
    expect(out.user.id).toBe("u1");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("throws ApiError with machine code on failure envelope", async () => {
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => null, fetchImpl: vi.fn().mockResolvedValue(err("ENTITLEMENT_EXHAUSTED")) as any });
    await expect(api.get("/subscriptions")).rejects.toMatchObject({ code: "ENTITLEMENT_EXHAUSTED" });
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

`src/client.ts`:
```typescript
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}
export function createApiClient(opts: ApiClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await opts.getToken();
    let res: Response;
    try {
      res = await f(`${opts.baseUrl}/api/v1${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) { throw new ApiError("NETWORK", "Cannot reach the server. Check your connection.", 0); }
    const envelope = await res.json().catch(() => null);
    if (envelope?.success) return envelope.data as T;
    throw new ApiError(envelope?.error?.code ?? "INTERNAL", envelope?.error?.message ?? "Unexpected error", res.status);
  }
  return {
    get: <T>(p: string) => call<T>("GET", p),
    post: <T>(p: string, b?: unknown) => call<T>("POST", p, b),
    patch: <T>(p: string, b?: unknown) => call<T>("PATCH", p, b),
    createSession: () => call<import("@autocare/contracts").SessionResponse>("POST", "/auth/session"),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: typed api client over shared contracts"`

---

### Task 9: Next.js web shell

**Files:**
- Create: `apps/web/package.json`, `next.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/login/page.tsx`, `app/(public)/c/[token]/page.tsx` (placeholder route only), `middleware.ts`
- Test: `apps/web/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `tailwindPreset`, `toCssVars` from `@autocare/design-tokens`; `createApiClient` from `@autocare/api-client`.
- Produces: `pnpm --filter web dev` serves login page at `/login` styled with tokens; `middleware.ts` redirects unauthenticated `/staff/*` and `/admin/*` to `/login` (session cookie named `ac_session`, wired to Firebase in Phase 1).

- [ ] **Step 1: Scaffold**

Run: `pnpm create next-app@14 apps/web --ts --app --tailwind --no-src-dir --import-alias "@/*" --use-pnpm`
Then add workspace deps: `pnpm --filter web add @autocare/design-tokens@workspace:* @autocare/api-client@workspace:*` and dev deps `vitest @testing-library/react @vitejs/plugin-react jsdom`.

- [ ] **Step 2: Wire tokens**

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";
import { tailwindPreset } from "@autocare/design-tokens";
export default { presets: [tailwindPreset as Config], content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] } satisfies Config;
```

`app/layout.tsx` loads Google fonts Barlow Semi Condensed (600), Inter (400/500/600), IBM Plex Mono (500) via `next/font` and sets `<body className="bg-chassis text-ink font-body">`.

- [ ] **Step 3: Write failing login page test**

`app/login/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("login page", () => {
  it("offers staff sign-in", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /autocare\+/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
  });
});
```

Run: `pnpm --filter web test` → FAIL.

- [ ] **Step 4: Implement login shell**

`app/login/page.tsx` — client component: centered `bg-surface rounded-md` card on `bg-chassis`, `font-display` "AutoCare+" heading with `text-primary-deep`, email+password fields (44px height), primary button `bg-primary text-white h-12 rounded-sm` labeled "Sign in" (disabled state only for now — Firebase wiring is Phase 1), and a muted note "Staff access only. Members use the mobile app."

`middleware.ts`:
```typescript
import { NextResponse, type NextRequest } from "next/server";
export function middleware(req: NextRequest) {
  const protectedPath = req.nextUrl.pathname.startsWith("/staff") || req.nextUrl.pathname.startsWith("/admin");
  if (protectedPath && !req.cookies.get("ac_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/staff/:path*", "/admin/:path*"] };
```

- [ ] **Step 5: Run tests + build** — `pnpm --filter web test && pnpm --filter web build` → PASS, build succeeds.
- [ ] **Step 6: Commit** — `git commit -m "feat(web): Next.js shell with design tokens, login page, role-gate middleware"`

---

### Task 10: Expo member app shell (iOS-first)

**Files:**
- Create: `apps/member/` via Expo template; `app.json`, `src/theme/index.ts`, `src/app/App.tsx`, `src/features/auth/LoginScreen.tsx`, `src/shared/api.ts`
- Test: `apps/member/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: `@autocare/design-tokens`, `@autocare/api-client`, `expo-secure-store`.
- Produces: `theme` object `{ colors, spacing, radii, text }` where `text(role: keyof typeof typeScale)` returns a RN `TextStyle` with px sizes (rem × 16); app boots to a login screen on the iOS simulator; `src/shared/api.ts` exports a singleton `api` whose `getToken` reads `expo-secure-store` key `"firebase_id_token"` (NFR-018).

- [ ] **Step 1: Scaffold**

Run: `pnpm create expo-app@latest apps/member --template blank-typescript`
Add deps: `pnpm --filter member add @autocare/design-tokens@workspace:* @autocare/api-client@workspace:* expo-secure-store @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context`
Dev: `jest jest-expo @testing-library/react-native`. Set `app.json` → `"ios": { "supportsTablet": false, "bundleIdentifier": "ph.autocare.member" }`, name "AutoCare+".

- [ ] **Step 2: Write failing theme test**

`src/theme/theme.test.ts` (jest-expo):
```typescript
import { theme } from "./index";

describe("member theme", () => {
  it("maps rem type scale to RN px", () => {
    expect(theme.text("body").fontSize).toBe(16);
    expect(theme.text("score").fontSize).toBe(72);
  });
  it("uses token colors", () => {
    expect(theme.colors.primary).toBe("#0E5AA7");
  });
  it("meets member tap target minimum", () => {
    expect(theme.minTarget).toBeGreaterThanOrEqual(48);
  });
});
```

Run: `pnpm --filter member test` → FAIL.

- [ ] **Step 3: Implement theme + screens**

`src/theme/index.ts`:
```typescript
import { colors, spacing, radii, typeScale, targets, vhsBands, fontStacks } from "@autocare/design-tokens";
import type { TextStyle } from "react-native";

const familyFor = { display: "BarlowSemiCondensed_600SemiBold", body: "System", mono: "IBMPlexMono_500Medium" } as const;

export const theme = {
  colors, spacing, radii, vhsBands,
  minTarget: targets.memberMinDp,
  text(role: keyof typeof typeScale): TextStyle {
    const t = typeScale[role];
    return { fontSize: Math.round(t.size * 16), fontWeight: String(t.weight) as TextStyle["fontWeight"], fontFamily: familyFor[t.family] };
  },
};
```

`App.tsx`: NavigationContainer → native stack with `LoginScreen`. `LoginScreen`: `colors.chassis` background, "AutoCare+" in display type + `primaryDeep`, phone-number field, 48pt-high primary button "Continue" (non-functional until Phase 1 OTP), footnote "By continuing you agree to our Terms and Privacy Policy."

`src/shared/api.ts`:
```typescript
import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@autocare/api-client";
export const api = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
  getToken: () => SecureStore.getItemAsync("firebase_id_token"),
});
```

- [ ] **Step 4: Run tests + boot on iOS simulator**

Run: `pnpm --filter member test` → PASS. Then `pnpm --filter member exec expo run:ios` (or `expo start --ios`).
Expected: login screen renders with correct colors/typography. Screenshot it into the PR.

- [ ] **Step 5: Commit** — `git commit -m "feat(member): Expo shell — token theme, login screen, secure token storage"`

---

### Task 11: Expo field app shell (high-contrast variant)

**Files:**
- Create: `apps/field/` (same scaffold as Task 10, bundle id `ph.autocare.field`, name "AutoCare+ Field")
- Create: `src/theme/index.ts`, `src/shared/SyncBanner.tsx`, `src/features/auth/StaffLoginScreen.tsx`
- Test: `apps/field/src/theme/theme.test.ts`, `src/shared/SyncBanner.test.tsx`

**Interfaces:**
- Consumes: `@autocare/design-tokens` (same tokens — the field theme derives, never redefines).
- Produces: `fieldTheme` with `minTarget = targets.fieldMinDp` (56) and every `text()` role one size step larger (×1.125); `<SyncBanner pendingCount={n} />` — the persistent offline indicator required by F-03, rendered on every field screen from Phase 4 on: hidden when `n === 0`, otherwise `primaryDeep` bar with "3 items waiting to sync".

- [ ] **Step 1: Write failing tests**

`src/theme/theme.test.ts`:
```typescript
import { fieldTheme } from "./index";
describe("field theme", () => {
  it("enforces 56dp gloved targets (NFR-027)", () => { expect(fieldTheme.minTarget).toBeGreaterThanOrEqual(56); });
  it("scales type up one step from member sizes", () => { expect(fieldTheme.text("body").fontSize).toBe(18); });
});
```

`src/shared/SyncBanner.test.tsx`:
```tsx
import { render } from "@testing-library/react-native";
import { SyncBanner } from "./SyncBanner";
describe("SyncBanner", () => {
  it("hides when queue is empty", () => {
    expect(render(<SyncBanner pendingCount={0} />).toJSON()).toBeNull();
  });
  it("shows pending count", () => {
    const { getByText } = render(<SyncBanner pendingCount={3} />);
    getByText("3 items waiting to sync");
  });
});
```

Run: `pnpm --filter field test` → FAIL.

- [ ] **Step 2: Implement**

`src/theme/index.ts` mirrors the member theme but `minTarget: targets.fieldMinDp` and `fontSize: Math.round(t.size * 16 * 1.125)`. `SyncBanner`:
```tsx
import { Text, View } from "react-native";
import { colors, spacing } from "@autocare/design-tokens";

export function SyncBanner({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) return null;
  return (
    <View style={{ backgroundColor: colors.primaryDeep, padding: spacing.sm }} accessibilityRole="alert">
      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center" }}>
        {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync
      </Text>
    </View>
  );
}
```

`StaffLoginScreen`: same structure as member login, 56pt controls, "Staff sign-in" heading.

- [ ] **Step 3: Run tests** → PASS. Boot on iOS simulator, screenshot.
- [ ] **Step 4: Commit** — `git commit -m "feat(field): Expo shell — high-contrast field theme, sync banner"`

---

### Task 12: CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: turbo tasks from Task 1; services from Task 4.
- Produces: on every push/PR — install, lint, typecheck, test across the workspace with Postgres+Redis service containers; the build fails on any type mismatch between API and clients (risk R-11 mitigation).

- [ ] **Step 1: Write workflow**

```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env: { POSTGRES_USER: autocare, POSTGRES_PASSWORD: autocare, POSTGRES_DB: autocare }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U autocare" --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    env:
      DATABASE_URL: postgresql://autocare:autocare@localhost:5432/autocare
      REDIS_URL: redis://localhost:6379
      FIREBASE_PROJECT_ID: ci-stub
      FIREBASE_CLIENT_EMAIL: ci@ci-stub.iam.gserviceaccount.com
      FIREBASE_PRIVATE_KEY: "stub"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma migrate deploy
      - run: pnpm turbo run typecheck lint test
```

Note: the auth e2e suite overrides `FirebaseService`, so stub Firebase env values are sufficient in CI; `FirebaseService.onModuleInit` must therefore tolerate initialization being skipped in test runs (guard with `NODE_ENV === "test"` if needed).

- [ ] **Step 2: Verify locally then on CI**

Run: `pnpm turbo run typecheck lint test` locally → all green. Push a branch, open a PR, confirm the workflow passes.

- [ ] **Step 3: Commit** — `git add .github && git commit -m "ci: lint, typecheck, test with postgres/redis services"`

---

## Phase 0 exit criteria

- `docker compose up` + `pnpm --filter api start:dev` serves `GET /api/v1/health` in the envelope format.
- A real Firebase ID token exchanges successfully at `POST /auth/session` (R-01 closed, evidence recorded).
- Member and field apps boot on the iOS simulator with token-derived theming; web login page builds and renders.
- `pnpm turbo run typecheck lint test` green locally and in CI.
- Design tokens exist once, consumed by all three frontends.
