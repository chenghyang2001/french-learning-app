<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles: None
Added sections:
  - Principle VI: 文件語言（Document Language）
Removed sections: None
Templates requiring updates:
  - .specify/templates/spec-template.md ✅ (headings translated to Traditional Chinese 2026-06-28)
  - .specify/templates/plan-template.md ✅ (headings translated to Traditional Chinese 2026-06-28)
  - .specify/templates/tasks-template.md ✅ (headings translated to Traditional Chinese 2026-06-28)
  - .specify/templates/checklist-template.md ✅ (headings translated to Traditional Chinese 2026-06-28)
Follow-up TODOs:
  - None
-->

# French Learning App Constitution

## Core Principles

### I. Learner-First UX (NON-NEGOTIABLE)

Every feature decision MUST be evaluated from the learner's perspective first.
UI flows MUST minimize cognitive load—learners are simultaneously processing
a foreign language; the interface MUST NOT add confusion on top of that.

- Every screen MUST have a single, clear primary action
- Progress feedback MUST be immediate (< 200 ms visual response)
- Error messages MUST be encouraging, never punishing
- All interactive elements MUST be keyboard and screen-reader accessible

**Rationale**: Language acquisition fails when frustration with the tool
overwhelms frustration with the language itself. Learner trust is the
product's core asset.

### II. Progressive Skill Architecture

The app's feature set MUST reflect the natural sequence of language acquisition:
vocabulary → grammar patterns → listening comprehension → production (writing/speaking).

- Each feature MUST map to exactly one skill tier (vocabulary, grammar, listening, production)
- Higher tiers MUST NOT be unlocked until prerequisite tiers have sufficient coverage
- Spaced repetition MUST govern review scheduling; no feature may bypass this algorithm
- Lesson content MUST be graded (A1 → B2 CEFR levels); level jumping requires explicit user intent

**Rationale**: Random exposure is ineffective for adult learners. Structured
progression backed by SRS is the evidence-based standard.

### III. Test-Driven Development (NON-NEGOTIABLE)

TDD is mandatory for all business logic. The Red-Green-Refactor cycle MUST
be strictly enforced.

- Tests MUST be written and confirmed failing before implementation begins
- Unit tests: all services, utilities, and data-transformation functions
- Integration tests: all API endpoints (including auth and error paths)
- E2E tests (Playwright): core learner journeys (lesson flow, review session, progress dashboard)
- No PR may be merged if test coverage for new code drops below 80%

**Rationale**: Flashcard and SRS logic is subtle; off-by-one errors in interval
calculation silently corrupt the learner's review schedule. Tests are the only
reliable guard.

### IV. Data Privacy & Progress Integrity

Learner data is sensitive personal information and MUST be treated accordingly.

- All learner progress data MUST be stored in the project's own Neon PostgreSQL instance;
  no third-party analytics service may receive individual-level learning data
- Passwords MUST be hashed with bcrypt (min cost 12); plaintext MUST never appear in logs
- All SQL queries MUST use parameterized statements; string interpolation into SQL is FORBIDDEN
- API endpoints that expose learner data MUST require authentication (JWT, NextAuth v5)
- `.env` files and credential files MUST be in `.gitignore`; a `.env.example` MUST be provided

**Rationale**: Learner vocabulary mistakes and progress are personally revealing.
A data breach would destroy trust and expose users to embarrassment.

### V. Simplicity & YAGNI

Start with the simplest implementation that satisfies the current user story.
Add complexity only when a concrete, demonstrated need arises.

- Maximum 3 database tables per feature unless a fourth is explicitly justified in `plan.md`
- No abstraction layer (repository pattern, service bus, etc.) without a documented reason
- Dependencies MUST be evaluated for bundle-size impact before adoption
- Prefer Next.js built-ins (App Router, Server Components, API Routes) over third-party equivalents

**Rationale**: This is an MVP. Over-engineering now creates dead weight that
slows future iteration. Simplicity enables rapid validated learning.

### VI. 文件語言（NON-NEGOTIABLE）

所有 SpecKit 產生的文件——包括 `spec.md`、`plan.md`、`tasks.md`、
`data-model.md`、`quickstart.md`、`contracts/`、以及各類核對清單——
都 **必須** 以 **繁體中文** 撰寫。

以下技術識別符維持英文，不得翻譯：

- 需求編號：FR-001、SC-001、CHK001、T001 等
- 程式碼區塊、檔案路徑、API 端點路徑
- 沒有既定中文譯名的技術術語（如 BDD、SRS、CEFR）
- BDD 驗收情境關鍵字：**Given / When / Then**

**依據**：主要開發者以繁體中文閱讀與思考。英文規格書會產生
額外的認知翻譯負擔，拖慢理解速度並增加需求誤解風險。

## Technology Constraints

**Frontend**: Next.js 16 App Router · TypeScript (strict mode) · Tailwind CSS · shadcn/ui

**Backend**: Next.js API Routes · NextAuth v5 (JWT sessions)

**Database**: Neon Serverless PostgreSQL · Drizzle ORM (preferred) or parameterized raw SQL

**Testing**: Vitest (unit/integration) · Playwright (E2E)

**Deployment**: Vercel (production) · environment variables via Vercel Dashboard (never committed)

**Forbidden patterns**:

- `any` TypeScript type without a suppression comment explaining why
- Direct database access from client components (MUST go through API Routes)
- `dangerouslySetInnerHTML` without explicit XSS sanitization
- Hardcoded user paths (`C:\Users\...`); use environment variables or `process.env`

## Development Workflow

1. **Spec before code**: For any feature > 50 lines, `/speckit-specify` MUST produce
   an approved `spec.md` before implementation begins
2. **Plan before implement**: `/speckit-plan` MUST produce an approved `plan.md`
   (including a passing Constitution Check) before tasks are created
3. **Tasks are atomic**: Each task in `tasks.md` MUST be independently implementable,
   testable, and committable without depending on partially-complete sibling tasks
4. **Red before green**: For any task involving business logic, commit the failing test
   before committing the implementation
5. **PR checklist**: All PRs MUST pass linting (`eslint`), type-check (`tsc --noEmit`),
   and the full test suite before review
6. **Commit language**: Commit messages MUST be in Traditional Chinese with a verb prefix
   (新增 / 修復 / 重構 / 更新 / 移除), e.g., `新增 SRS 間隔計算服務`

## Governance

This constitution supersedes all informal conventions and README guidance.
Any practice not addressed here defaults to the project's global `CLAUDE.md` rules.

**Amendment procedure**:

1. Propose change in a dedicated PR with rationale
2. Re-run `/speckit-constitution` to update version and propagate to templates
3. Update any `plan.md` or `spec.md` affected by the change
4. Merge only after all affected documents are consistent

**Versioning policy** (semantic):

- MAJOR: Principle removed, renamed, or its non-negotiable status changed
- MINOR: New principle or section added; existing principle materially expanded
- PATCH: Wording clarification, typo fix, non-semantic refinement

**Compliance review**: Every `/speckit-plan` run performs a Constitution Check
gate. Violations MUST be either resolved or formally justified in `plan.md`
under the Complexity Tracking table before the plan is approved.

**Version**: 1.1.0 | **Ratified**: 2026-06-28 | **Last Amended**: 2026-06-28
