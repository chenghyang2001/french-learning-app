# Quickstart Validation Guide: Vocabulary Quiz

**Purpose**: Prove the feature works end-to-end without reading implementation code.
**Date**: 2026-06-28
**Refs**: [API contract](contracts/api.md) · [Data model](data-model.md)

---

## Prerequisites

- Node.js 18 or later (`node --version`)
- The app has been set up (`npm install` run at project root)
- SQLite DB initialized (`node db/init.js` or equivalent setup command)

---

## Setup: Seed Test Data

Before running validation scenarios, seed at least 15 French words so quiz
readiness thresholds are met.

Run the seed script (created during implementation):

```bash
node db/seed-test.js
```

Expected output:

```
Seeded 15 test words into words table.
Seeded 500 fallback words into fallback_words table.
```

---

## Start the Server

```bash
node server.js
```

Expected output:

```
French Quiz running at http://localhost:3000
SQLite: data/french-quiz.db
```

---

## Validation Scenarios

### Scenario A — Readiness check passes

```bash
curl http://localhost:3000/api/quiz/readiness
```

**Expected**:

```json
{ "ready": true, "word_count": 15 }
```

---

### Scenario B — Full quiz flow (happy path)

**Step 1**: Create a new session

```bash
curl -X POST http://localhost:3000/api/quiz/sessions
```

**Expected**: HTTP 201, body contains `session_id` (e.g., `1`) and
`current_question` with `question_num: 1`, a French `prompt`, and
four `options` keys (`a`–`d`).

**Step 2**: Note the `session_id` from Step 1. Submit a correct answer
(look up which option matches the English translation from seed data):

```bash
curl -X POST http://localhost:3000/api/quiz/sessions/1/answers \
  -H "Content-Type: application/json" \
  -d '{"selected":"b"}'
```

**Expected**: `is_correct: true`, `next_question.question_num: 2`.

**Step 3**: Continue answering until question 10 is submitted.

**Expected on final answer**: `session_complete: true`, `next_question: null`.

---

### Scenario C — Results screen

After Scenario B completes session `1`:

```bash
curl http://localhost:3000/api/quiz/sessions/1/results
```

**Expected**:

```json
{
  "session_id": 1,
  "status": "completed",
  "total_questions": 10,
  "correct_count": <N>,
  "incorrect_count": <10 - N>,
  "percentage": <N * 10>
}
```

Verify `correct_count + incorrect_count = 10`.

---

### Scenario D — Missed words review

Intentionally answer at least one question wrong in a quiz.
After completing, fetch missed words:

```bash
curl http://localhost:3000/api/quiz/sessions/<id>/missed
```

**Expected**: `missed_count >= 1`, each item in `missed_words` has:

- `french` matching the word that was shown
- `correct_answer` matching the true English translation
- `selected_answer` matching what was submitted (wrong)

---

### Scenario E — SRS schedule updated after quiz

After completing a quiz (Scenario B), verify SRS intervals changed:

```bash
curl http://localhost:3000/api/words
```

**Expected**: Words that were answered **correctly** show `srs_interval > 1`
(doubled from their pre-quiz value). Words answered **incorrectly** show
`srs_interval = 1` and `next_review_at` set to tomorrow.

---

### Scenario F — Not enough words (edge case)

Temporarily delete words to leave only 7:

```bash
# In the SQLite DB directly, or via a test-only endpoint
sqlite3 data/french-quiz.db "DELETE FROM words WHERE id > 7;"
curl http://localhost:3000/api/quiz/readiness
```

**Expected**: `{ "ready": false, "word_count": 7, "required": 10, ... }`

Attempting to create a session:

```bash
curl -X POST http://localhost:3000/api/quiz/sessions
```

**Expected**: HTTP 400, `{ "error": "Not enough learned words..." }`.

Re-seed before continuing: `node db/seed-test.js`.

---

### Scenario G — Browser UI smoke test

Open `http://localhost:3000` in a browser.

1. Home page shows a "Start Quiz" button (or readiness message if < 10 words)
2. Clicking "Start Quiz" shows the first question with four radio/button options
3. Selecting an option immediately shows green (correct) or red (incorrect) highlight
4. After all 10 questions: results screen shows score (e.g., "8 / 10 — 80%")
5. If any wrong answers: "Review Missed Words" button is visible and clickable
6. Review screen lists each missed word with correct translation and wrong guess

---

## Validation Checklist

- [ ] Scenario A: Readiness check returns `ready: true` with seeded data
- [ ] Scenario B: Full 10-question session completes without errors
- [ ] Scenario C: Results endpoint returns correct totals summing to 10
- [ ] Scenario D: Missed words list matches intentionally wrong answers
- [ ] Scenario E: SRS intervals updated correctly after session completion
- [ ] Scenario F: Under-threshold case returns 400 and helpful message
- [ ] Scenario G: Browser UI flows match expected screens at each step

All 7 scenarios passing = feature ready for delivery.
