# Research: Vocabulary Quiz — Technical Decisions

**Phase 0 output for plan.md**
**Date**: 2026-06-28
**Constraint**: Minimum dependencies · Native HTML/CSS/JS · Local SQLite · No image uploads

---

## Decision 1: SQLite Access Strategy

**Question**: How to access SQLite from a vanilla-JS web app?

| Option | Dependencies | Trade-offs |
|--------|-------------|------------|
| `better-sqlite3` + Node.js server | 1 package | Synchronous API, fastest, most ergonomic; requires a running process |
| `sql.js` (SQLite compiled to WASM) | 1 package | Runs in browser; no server needed; 1.5 MB WASM download; async persistence to IndexedDB adds complexity |
| Native `http` module + `sqlite3` | 1 package | Callback-style API; async/callback hell for multi-step quiz logic |
| Browser IndexedDB (no SQLite) | 0 packages | Does not satisfy user's explicit "SQLite database" requirement |

**Decision**: `better-sqlite3` + minimal Node.js Express server

**Rationale**: Synchronous API eliminates async complexity in server handlers.
Trivially fast for local use (SQLite on local disk). User explicitly requested
SQLite (not an alternative). One npm package for DB access.

**Alternatives considered**: `sql.js` is viable but adds a 1.5 MB WASM bundle
and complicates data persistence (must serialize the DB to IndexedDB or a file
via the File System Access API on every write). Rejected in favour of simplicity.

---

## Decision 2: HTTP Server Strategy

**Question**: Do we need a server? Which one?

| Option | Dependencies | Trade-offs |
|--------|-------------|------------|
| No server (`file://` protocol) | 0 | CORS blocks `fetch()` calls; no path for SQLite access |
| Node.js native `http` module | 0 | Manual routing = significant boilerplate |
| `express` | 1 package | Minimal routing, middleware; widely understood; tiny overhead |
| `fastify` | 1 package | Faster than Express but unnecessary at local scale |
| `hono` | 1 package | Modern, tiny; less documentation; no advantage here |

**Decision**: `express@4` (single package)

**Rationale**: 1 package, minimal surface area, excellent routing for ~6 endpoints.
Local-only use means performance difference vs. native `http` is imperceptible.
`express` keeps `server.js` under 60 lines.

---

## Decision 3: Testing Approach (No Framework)

**Question**: How to implement TDD (Constitution Principle III) without test frameworks?

| Option | Dependencies | Notes |
|--------|-------------|-------|
| `node:test` + `assert` (built-in) | 0 | Available since Node.js 18; TAP output; supports async |
| `jest` | 1 package | Violates "minimum dependencies" requirement |
| `mocha` + `chai` | 2 packages | Violates requirement |
| Manual scripts | 0 | No structured output; no CI integration |

**Decision**: Node.js built-in `node:test` module with `assert`

**Rationale**: Zero additional dependencies. Covers unit tests (SRS interval
logic, distractor selection) and integration tests (Express routes via `fetch`
against a test DB). Run with `node --test tests/**/*.test.js`.

---

## Decision 4: Authentication Simplification

**Question**: FR-001 assumes "authenticated learner." How to handle auth in a
local single-user app?

**Finding**: Running on `localhost:3000` provides implicit access control — only
users with access to the local machine can use the app. Adding a login system
(session cookies, password hashing) would violate Principle V (YAGNI) and add
2+ dependencies (`bcrypt`, `express-session`).

**Decision**: No authentication. App serves any request to `localhost`. "Learner"
identity = the local machine user.

**Rationale**: Security threat model for a local app is fundamentally different
from a cloud app. No personal data leaves the device. Omitting auth is the
correct YAGNI decision here. Documented as deviation in plan.md Complexity Tracking.

---

## Decision 5: Distractor Selection Algorithm

**Question**: How to pick 3 wrong options per quiz question that are meaningfully
difficult (not trivially obviously wrong)?

| Option | Rationale |
|--------|-----------|
| Purely random from learned vocabulary | Simple but may produce trivially easy distractors |
| Same CEFR level first, then any level | Slightly harder; same-level words are more plausible |
| Semantic distance (embeddings) | Requires ML library; violates minimum dependencies |

**Decision**: Prefer same-CEFR-level words; fall back to any learned word;
pad from `fallback_words` table if pool is still insufficient.

**Rationale**: Achievable with a single SQL query using `ORDER BY RANDOM()` +
`WHERE cefr_level = ?`. No ML needed. Satisfies FR-003.

---

## Decision 6: SRS Interval Calculation

**Question**: Which spaced repetition algorithm?

**Finding**: Full SM-2 (SuperMemo-2) requires per-word "ease factor" tracking
and is complex. A simplified version is sufficient for MVP per Principle V.

**Decision**: Simplified two-rule SRS:

- Correct → `new_interval = MIN(current_interval * 2, 30)` days
- Incorrect → `new_interval = 1` day (reset)
- `next_review_at = date('now', '+N days')` in SQLite

**Rationale**: Implements exponential back-off (core SRS principle) with zero
additional logic. Can be upgraded to full SM-2 in a later iteration.

---

## Resolved Technical Context Summary

| Field | Value |
|-------|-------|
| Language/Version | HTML5 / CSS3 / JavaScript ES2022 / Node.js 18+ |
| Primary Dependencies | `express@4`, `better-sqlite3@9` (2 packages total) |
| Storage | SQLite — `data/french-quiz.db` (local file, never uploaded) |
| Testing | `node:test` + `assert` (Node.js built-in, 0 extra packages) |
| Target Platform | Local browser via `localhost:3000` |
| Project Type | Local web application (HTML served by Express) |
| Performance Goals | Answer feedback < 200 ms; question load < 500 ms |
| Constraints | Offline-only; no external network calls; no image uploads |
| Scale/Scope | Single learner; 10–1,000 vocabulary items |
