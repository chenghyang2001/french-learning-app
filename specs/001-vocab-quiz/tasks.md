---

description: "Task list for Vocabulary Quiz feature implementation"
---

# Tasks: Vocabulary Quiz

**Input**: Design documents from `specs/001-vocab-quiz/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅

**Tests**: Included (Constitution Principle III — TDD NON-NEGOTIABLE). All test tasks
must be completed and confirmed **failing** before the corresponding implementation tasks begin.

**Organization**: Tasks are grouped by user story. Each story delivers an independently
testable, runnable increment.

**Tech stack** (from plan.md): Node.js 18 · `express@4` · `better-sqlite3@9` · Vanilla HTML/CSS/JS
· `node:test` + `assert` (0 test-framework packages)

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (different files, no dependencies within the group)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Initialize project structure and package manifest so all subsequent
phases can begin.

- [X] T001 Create directory structure: `mkdir -p api db data public/css public/js tests`
- [X] T002 Create `package.json` with `{"name":"french-quiz","version":"1.0.0","main":"server.js","scripts":{"start":"node server.js","test":"node --test tests/**/*.test.js","init":"node db/init.js","seed":"node db/seed-test.js"},"dependencies":{"express":"^4","better-sqlite3":"^9"}}`
- [X] T003 [P] Create `.gitignore` excluding `node_modules/`, `data/*.db`, `.DS_Store`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, seed data, server skeleton, and DB connection must
all be in place before any User Story work can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create `db/schema.sql` with all four CREATE TABLE IF NOT EXISTS statements: `words`, `fallback_words`, `quiz_sessions`, `quiz_questions` — use exact DDL from `data-model.md`
- [X] T005 [P] Create `db/seed-fallback.sql` with ≥ 500 A1–A2 French vocabulary INSERT statements (common nouns, verbs, adjectives); each row: `(french, english, cefr_level)`
- [X] T006 Create `db/init.js` — reads `db/schema.sql` and `db/seed-fallback.sql`, executes both against `data/french-quiz.db` using `better-sqlite3`; idempotent (safe to re-run)
- [X] T007 Create `api/db.js` — exports a `better-sqlite3` Database singleton; opens `data/french-quiz.db` on first import; throws with clear message if DB file does not exist (run `node db/init.js` first)
- [X] T008 Create `server.js` — minimal Express app: mount `api/quiz.js` at `/api/quiz`, mount `api/words.js` at `/api/words`, serve `public/` as static files, listen on `PORT` env var or `3000`
- [X] T009 [P] Create `db/seed-test.js` — inserts exactly 15 French vocabulary entries into `words` table with a deliberate CEFR skew: ≥ 12 words at A1, exactly 1 word at B2 (total < 3 B2 words), to guarantee the FR-003 fallback path is exercisable in T012(g); safe to re-run (DELETE + re-insert)
- [X] T010 Run `npm install` to install `express` and `better-sqlite3` packages

**Checkpoint**: Run `node db/init.js && node db/seed-test.js && node server.js` — server must start without errors before Phase 3 begins.

---

## Phase 3: User Story 1 — Complete a Quiz Session (Priority: P1) 🎯 MVP

**Goal**: Learner can start a quiz, answer 10 multiple-choice questions one by one,
receive immediate correct/incorrect feedback per question, and see a final score screen.

**Independent Test**: After T018, run quickstart Scenarios A, B (browser UI) and
API Scenarios A + B from `quickstart.md`. Quiz session must complete end-to-end.

### Tests for User Story 1 ⚠️ Write FIRST — confirm they FAIL before T013

- [X] T011 [P] [US1] Write failing tests for `GET /api/quiz/readiness` in `tests/quiz.test.js`: (a) returns `ready:true` when ≥ 10 words exist; (b) returns `ready:false` with `word_count` and `required` when < 10 words
- [X] T012 [P] [US1] Write failing tests for `POST /api/quiz/sessions` and `POST /api/quiz/sessions/:id/answers` in `tests/quiz.test.js`: (a) creates session with `session_id` and first question with 4 distinct options; (b) submitting correct option returns `is_correct:true` and advances `question_num`; (c) submitting invalid option returns HTTP 400; (d) submitting after session complete returns HTTP 400; (e) every question's `option_a`–`option_d` are 4 distinct English strings with no duplicate values within a question (verifies FR-003 uniqueness invariant); (f) the `correct_answer` stored per question equals exactly one of `option_a`–`option_d` — the correct answer is never absent from the shuffled choices; (g) session creation succeeds and returns 4 distinct options even when the seed data has < 3 words sharing the quiz word's CEFR level, confirming FR-003 fallback path draws from `fallback_words`

### Implementation for User Story 1

- [X] T013 [US1] Implement `GET /api/quiz/readiness` handler in `api/quiz.js` — count rows in `words`, return `{ready, word_count, required: 10}` (or error message)
- [X] T014 [US1] Implement `POST /api/quiz/sessions` in `api/quiz.js` — sample 10 random `words`, for each word: select 3 distractors (same CEFR level first, fallback to `fallback_words`), shuffle 4 options into `option_a`–`option_d`, persist `quiz_sessions` + 10 `quiz_questions` rows, return session and first question
- [X] T015 [US1] Implement `POST /api/quiz/sessions/:id/answers` in `api/quiz.js` — validate `selected` ∈ {a,b,c,d}, find current unanswered question, record `selected_answer`, set `is_correct`, update `correct_count`, if question 10 answered set `status='completed'` and `completed_at`, return feedback + next question (or `session_complete:true`)
- [X] T016 [US1] Create `public/js/api.js` — thin `fetch()` wrappers: `checkReadiness()`, `createSession()`, `submitAnswer(sessionId, selected)`, `getResults(sessionId)`, `getMissed(sessionId)` — all return parsed JSON, throw on non-2xx
- [X] T017 [US1] Create `public/css/app.css` — styles for: start screen, question card (French prompt + 4 option buttons), correct highlight (green border/background), incorrect highlight (red border/background + correct option highlighted), results screen; keyboard focus rings on buttons; no external fonts or CDN assets
- [X] T018 [US1] Create `public/index.html` — semantic HTML shell with three view containers (`#view-start`, `#view-quiz`, `#view-results`); only one visible at a time; includes `<script src="/js/api.js">` and `<script src="/js/quiz.js">` and `<link rel="stylesheet" href="/css/app.css">`
- [X] T019 [US1] Create `public/js/quiz.js` — UI controller: on DOMContentLoaded check readiness and show start screen; on "Start Quiz" click call `createSession()` and render first question; on option button click call `submitAnswer()`, show correct/incorrect highlight for 1.5 s, then render next question or call `showResults()` on `session_complete`

**Checkpoint**: User Story 1 is fully functional. `node:test` passes T011–T012. Quickstart Scenarios A and B pass.

---

## Phase 4: User Story 2 — Review Missed Words (Priority: P2)

**Goal**: After completing a quiz, learner sees a results screen with score and can
view a list of all words they answered incorrectly.

**Independent Test**: Complete a quiz with ≥ 1 wrong answer via browser. Results screen
shows score. Click "Review Missed Words" to see each missed word with correct answer
and the learner's wrong guess (Quickstart Scenarios C and D).

### Tests for User Story 2 ⚠️ Write FIRST — confirm they FAIL before T022

- [X] T020 [P] [US2] Write failing tests for `GET /api/quiz/sessions/:id/results` in `tests/quiz.test.js`: (a) completed session returns `{total_questions:10, correct_count, incorrect_count, percentage}`; (b) in-progress session returns HTTP 400; (c) non-existent session returns HTTP 404
- [X] T021 [P] [US2] Write failing tests for `GET /api/quiz/sessions/:id/missed` in `tests/quiz.test.js`: (a) returns `missed_words` array with `{french, correct_answer, selected_answer}` for each wrong answer; (b) perfect score returns `{missed_count:0, missed_words:[]}`

### Implementation for User Story 2

- [X] T022 [US2] Implement `GET /api/quiz/sessions/:id/results` and `GET /api/quiz/sessions/:id/missed` in `api/quiz.js` — results: query `quiz_sessions` and compute `incorrect_count` and `percentage`; missed: join `quiz_questions` with `words` WHERE `is_correct=0`, return `{question_num, french, correct_answer, selected_answer}`
- [ ] T023 [US2] Update `public/js/quiz.js` `showResults()` function to display score (e.g., "8 / 10 — 80%") on `#view-results` and show a "Review Missed Words" button only when `incorrect_count > 0`; hide button and show congratulations message when perfect score
- [ ] T024 [US2] Create `public/js/review.js` — fetches `getMissed(sessionId)`, renders a list in `#view-results` showing each missed word as: French term (bold) → correct English (green) with a "You answered: [wrong answer]" label; include a "Try Again" button that calls `createSession()` to start a new quiz

**Checkpoint**: User Stories 1 AND 2 independently functional. `node:test` passes T020–T021. Quickstart Scenarios C and D pass.

---

## Phase 5: User Story 3 — Quiz Updates SRS Schedule (Priority: P3)

**Goal**: On quiz completion, each word's spaced repetition schedule is automatically
updated — correct answers push out the next review date; incorrect answers reset it to tomorrow.

**Independent Test**: After completing a quiz via API, call `GET /api/words` and
verify correct-answer words have `srs_interval` doubled (capped at 30) and
incorrect-answer words have `srs_interval = 1` (Quickstart Scenario E).

### Tests for User Story 3 ⚠️ Write FIRST — confirm they FAIL before T026

- [X] T025 [P] [US3] Write failing unit tests for SRS interval calculation in `tests/srs.test.js`: (a) `computeNewInterval(1, true)` → 2; (b) `computeNewInterval(15, true)` → 30 (cap); (c) `computeNewInterval(30, true)` → 30 (stays at cap); (d) `computeNewInterval(8, false)` → 1 (reset); (e) `computeNewInterval(1, false)` → 1

### Implementation for User Story 3

- [X] T026 [US3] Implement and export `computeNewInterval(currentInterval, isCorrect)` pure function in `api/quiz.js` — returns `Math.min(currentInterval * 2, 30)` if correct, `1` if incorrect; no DB access
- [X] T027 [US3] Implement `updateSrsForSession(db, sessionId)` in `api/quiz.js` — query all `quiz_questions` for the session, for each: call `computeNewInterval`, UPDATE `words` SET `srs_interval = newInterval`, `next_review_at = date('now', '+N days')` WHERE `id = word_id`
- [X] T028 [US3] Wire `updateSrsForSession` into the `POST /api/quiz/sessions/:id/answers` handler in `api/quiz.js` — call it synchronously after setting `status = 'completed'`, before returning the response

**Checkpoint**: All three user stories functional. `node:test` passes T025. Quickstart Scenario E (SRS update) passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: API completeness, error handling, and end-to-end validation.

- [X] T029 [P] Implement `GET /api/words` in `api/words.js` — query `words` table; support optional `?cefr=A1` filter and `?due=true` filter (`next_review_at <= date('now')`); return `{count, words:[...]}`
- [X] T030 Add global JSON error middleware in `server.js` — catch 404s (unknown routes) and unhandled 500 errors, always return `{error: "<message>"}` with correct HTTP status code (never HTML error pages)
- [X] T031 Add `<link rel="icon" href="data:,">` to `public/index.html` to suppress browser favicon 404 requests in server logs
- [X] T032 Run all quickstart validation Scenarios A–G from `quickstart.md` against the running app and confirm all 7 pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; integrates with US1 results data but independently testable
- **User Story 3 (Phase 5)**: Depends on Phase 3 (session completion endpoint must exist)
- **Polish (Phase 6)**: Depends on all story phases

### User Story Dependencies

- **User Story 1 (P1)**: Can start immediately after Foundational — no story dependencies
- **User Story 2 (P2)**: Can start immediately after Foundational — reads quiz_questions data US1 creates, but independently testable
- **User Story 3 (P3)**: Depends on US1 (POST .../answers endpoint must exist to wire into)

### Within Each User Story

```
Write tests (confirm FAIL) → Implement → Confirm tests PASS → Commit
```

### Parallel Opportunities

- T003, T005, T009 can run in parallel within their phases
- T011 and T012 can be written in parallel (different test cases)
- T016, T017 can run in parallel (different files, no dependency)
- T020 and T021 can be written in parallel
- T025 is independent (pure function test)

---

## Parallel Example: User Story 1

```bash
# Launch in parallel (different files):
# → T016: Create public/js/api.js
# → T017: Create public/css/app.css

# Sequential (dependency chain):
# T013 → T014 → T015 (each depends on previous)
# T018 → T019 (HTML shell before UI controller)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP AND VALIDATE**: Run quickstart Scenarios A + B; browse `http://localhost:3000` manually
5. If learner can complete a 10-question quiz end-to-end: MVP is ready

### Incremental Delivery

1. Setup + Foundational → Server starts ✅
2. Add US1 → Full quiz session works → MVP ✅
3. Add US2 → Missed-words review works ✅
4. Add US3 → SRS schedule updates on completion ✅
5. Polish → Error handling, API completeness, final validation ✅

---

## Notes

- `[P]` tasks = different output files, can be worked in parallel within a phase
- `[US1/2/3]` label maps each task to its user story for traceability
- **TDD discipline**: All tests tagged ⚠️ must be confirmed **failing** before writing implementation code
- Commit after each phase checkpoint (not each individual task)
- `node --test tests/**/*.test.js` runs all tests
- `node db/init.js && node db/seed-test.js` resets local DB to clean state for testing
