# Implementation Plan: Vocabulary Quiz

**Branch**: `001-vocab-quiz` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-vocab-quiz/spec.md`

## Summary

Build a 10-question multiple-choice vocabulary quiz that tests the learner's
recognition of French words (French prompt → select correct English translation).
The system samples from the learner's studied word list, selects three distractors
per question (same CEFR level preferred), delivers immediate per-answer feedback,
shows a results screen with score, and updates the spaced repetition schedule for
every word that appeared.

**Technical approach**: Minimal Node.js Express server (2 npm packages total)
serving static vanilla HTML/CSS/JS. Data persisted in a local SQLite file via
`better-sqlite3`. No framework, no bundler, no cloud services.

## Technical Context

**Language/Version**: HTML5 / CSS3 / JavaScript ES2022 / Node.js 18+

**Primary Dependencies**: `express@4` (HTTP server), `better-sqlite3@9` (SQLite driver) — 2 packages total

**Storage**: SQLite — `data/french-quiz.db` (local file, never leaves device)

**Testing**: `node:test` + `assert` (Node.js 18 built-ins, zero additional packages)

**Target Platform**: Local web browser at `http://localhost:3000`

**Project Type**: Local web application — static HTML served by Express

**Performance Goals**: Answer feedback < 200 ms · Question load < 500 ms
(both trivially met with local SQLite; no network I/O)

**Constraints**: Fully offline · No external network calls · No image uploads ·
No cloud credentials

**Scale/Scope**: Single learner, local device, 10–1,000 vocabulary items

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Learner-First UX | ✅ PASS | Single primary action per screen; local SQLite gives < 5 ms response (well under 200 ms); native HTML `<button>` is keyboard accessible by default |
| II. Progressive Skill Architecture | ✅ PASS | Quiz maps to vocabulary tier; SRS update on completion (FR-008); CEFR levels stored per word |
| III. TDD (NON-NEGOTIABLE) | ✅ PASS | `node:test` used for server-side unit + integration tests; tests written before implementation (see tasks.md) |
| IV. Data Privacy & Progress Integrity | ✅ PASS (strengthened) | Local SQLite = no data leaves device; `better-sqlite3` parameterized queries by default; no cloud credentials; no auth secrets |
| V. Simplicity & YAGNI | ✅ PASS (maximum) | 2 npm packages vs 15+ for Next.js stack; no bundler, no TypeScript compilation, no ORM, no cloud |

**Technology Constraints deviation**: Tech stack differs from constitution's
Technology Constraints section (Next.js/TypeScript/Neon). Justified in
Complexity Tracking below. All five *principles* pass.

**Post-Phase-1 re-check**: No new violations introduced. Data model uses
parameterized DDL; API contract uses standard REST patterns; quickstart
requires no external services.

## Project Structure

### Documentation (this feature)

```text
specs/001-vocab-quiz/
├── plan.md              # This file
├── research.md          # Phase 0 — technical decisions
├── data-model.md        # Phase 1 — SQLite schema + entity rules
├── quickstart.md        # Phase 1 — end-to-end validation guide
├── contracts/
│   └── api.md           # Phase 1 — REST API contract
└── tasks.md             # Phase 2 — created by /speckit-tasks (not yet)
```

### Source Code (repository root)

```text
french-learning-app/
├── server.js              # Express entry point; mounts /api routes; serves public/
├── package.json           # {"express": "^4", "better-sqlite3": "^9"}
├── package-lock.json
│
├── db/
│   ├── schema.sql         # CREATE TABLE statements (authoritative DDL)
│   ├── seed-fallback.sql  # 500 A1-A2 fallback words for distractor padding
│   ├── seed-test.js       # Seed 15 words for local development/testing
│   └── init.js            # Reads schema.sql + seed-fallback.sql; idempotent
│
├── data/
│   └── .gitkeep           # SQLite DB file created here at runtime (gitignored)
│
├── api/
│   ├── db.js              # better-sqlite3 singleton; opened once on startup
│   ├── words.js           # GET /api/words handler
│   └── quiz.js            # POST /api/quiz/sessions, POST .../answers, GET .../results, GET .../missed
│
├── public/
│   ├── index.html         # Single-page shell; all views rendered by JS
│   ├── css/
│   │   └── app.css        # Single stylesheet; no external fonts or CDN assets
│   └── js/
│       ├── api.js         # Thin fetch() wrappers for every API endpoint
│       ├── quiz.js        # Quiz session UI: start → questions → results
│       └── review.js      # Missed-words review list UI
│
└── tests/
    ├── quiz.test.js       # node:test — API routes (create session, submit answers, results, missed)
    └── srs.test.js        # node:test — SRS interval calculation unit tests
```

**Structure Decision**: Single-project layout. No frontend/backend split needed
because Express serves both the static HTML and the JSON API from one process.
All source under project root; `public/` for browser assets, `api/` for
server-side route handlers.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Tech stack departs from constitution's Technology Constraints (Vanilla JS + SQLite instead of Next.js + TypeScript + Neon PostgreSQL) | User explicitly requested minimum dependencies and offline-first local SQLite storage. Next.js requires a bundler, TypeScript compiler, Vercel account, and cloud DB credentials — all of which violate both the user's stated requirement and the spirit of Principle V (YAGNI). | Keeping Next.js would add ~15 packages, a build step, and cloud credentials. None of those complexities provide learner value for a single-user local app. Changing the stack is the simpler, more honest choice. |
| Authentication omitted (spec FR-001 says "authenticated learner") | Local single-user app; running on `localhost:3000` is the access control. Adding login (bcrypt + sessions) adds 2+ packages and UI flows with zero security benefit on a private machine. | A login screen for a local app would frustrate learners (Constitution Principle I) and violate Principle V. The spec's auth assumption was written for a multi-user cloud deployment, which is not this context. |
| 4 database tables (Constitution Principle V limit is 3 unless justified here) | FR-003 requires a built-in fallback distractor pool (≥ 500 A1–A2 words) that is strictly read-only seed data — never part of the learner's personal vocabulary. A separate `fallback_words` table enforces this boundary at the schema level: readiness checks (`SELECT COUNT(*) FROM words`) never accidentally count fallback words, and SRS updates never touch fallback rows. | (1) Merging into `words` with an `is_fallback` flag would contaminate readiness counts and SRS queries — every query would need a `WHERE is_fallback=0` guard. (2) Hardcoding 500 words as an in-process array loses CEFR-level filtering (`WHERE cefr_level = ?`) and makes the pool unmaintainable. The fourth table is the minimum-complexity option that satisfies FR-003 without polluting the learner data model. |
