# Data Model: Vocabulary Quiz

**Phase 1 output for plan.md**
**Date**: 2026-06-28
**Storage**: SQLite — `data/french-quiz.db`

---

## Entities

### 1. Word (learned vocabulary)

Represents a French vocabulary entry the learner has studied.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `french` | TEXT | NOT NULL UNIQUE | The French term shown as quiz prompt |
| `english` | TEXT | NOT NULL | The correct answer learners must recognize |
| `cefr_level` | TEXT | NOT NULL, CHECK IN ('A1','A2','B1','B2') | Used for same-level distractor selection |
| `srs_interval` | INTEGER | NOT NULL DEFAULT 1 | Days until next review (simplified SM-2) |
| `next_review_at` | TEXT | NOT NULL DEFAULT date('now') | ISO-8601 date string |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | ISO-8601 datetime |

**SRS update rules** (applied at session completion):

- Correct answer → `srs_interval = MIN(srs_interval * 2, 30)`
- Incorrect answer → `srs_interval = 1` (reset)
- `next_review_at = date('now', '+N days')` where N = new interval

**Business rules**:

- A word is eligible for a quiz if `created_at` exists (it has been learned)
- Minimum 10 words required to start a quiz (FR-001)

---

### 2. FallbackWord (built-in distractor pool)

Read-only table of common A1-level French words used to pad distractor options
when a learner's personal vocabulary pool is too small (FR-003).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `french` | TEXT | NOT NULL UNIQUE | |
| `english` | TEXT | NOT NULL | |
| `cefr_level` | TEXT | NOT NULL DEFAULT 'A1' | |

**Source**: Seeded from a bundled `db/seed-fallback.sql` at first run.
Target: ≥ 500 common French words (A1–A2).

---

### 3. QuizSession

Represents one complete quiz attempt.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `started_at` | TEXT | NOT NULL DEFAULT datetime('now') | ISO-8601 datetime |
| `completed_at` | TEXT | NULL | Set when status → completed |
| `total_questions` | INTEGER | NOT NULL DEFAULT 10 | Always 10 in MVP |
| `correct_count` | INTEGER | NOT NULL DEFAULT 0 | Incremented on each correct answer |
| `status` | TEXT | NOT NULL DEFAULT 'in_progress', CHECK IN ('in_progress','completed') | |

**State transitions**:

```
in_progress → completed (after question 10 is answered)
```

Partial sessions (browser closed mid-quiz) remain `in_progress` permanently.
They do not affect word SRS schedules.

---

### 4. QuizQuestion

One question within a quiz session.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `session_id` | INTEGER | NOT NULL REFERENCES quiz_sessions(id) | |
| `question_num` | INTEGER | NOT NULL | 1-based, 1–10 |
| `word_id` | INTEGER | NOT NULL REFERENCES words(id) | The French word being tested |
| `correct_answer` | TEXT | NOT NULL | English translation (copy at creation time) |
| `option_a` | TEXT | NOT NULL | One of the four choices (randomly ordered) |
| `option_b` | TEXT | NOT NULL | |
| `option_c` | TEXT | NOT NULL | |
| `option_d` | TEXT | NOT NULL | |
| `selected_answer` | TEXT | NULL | Learner's choice; NULL = unanswered |
| `is_correct` | INTEGER | NULL, CHECK IN (0,1) | Set when answered |
| `answered_at` | TEXT | NULL | ISO-8601 datetime |

**Distractor selection algorithm** (at session creation):

1. For each of the 10 quiz words, pick 3 distractors:
   a. Query `words` WHERE `id != word_id` AND `cefr_level = word.cefr_level` ORDER BY RANDOM() LIMIT 3
   b. If fewer than 3 returned → supplement from `fallback_words` ORDER BY RANDOM()
2. Shuffle the 4 options (correct + 3 distractors) into `option_a`–`option_d` at random

---

## Entity Relationships

```
words ──────────────────────< quiz_questions
                                     │
quiz_sessions ───────────────────────┘
                    (session_id FK)

fallback_words (read-only seed data, no FK relationships)
```

---

## SQLite Schema (DDL)

```sql
-- db/schema.sql

CREATE TABLE IF NOT EXISTS words (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    french         TEXT    NOT NULL UNIQUE,
    english        TEXT    NOT NULL,
    cefr_level     TEXT    NOT NULL CHECK(cefr_level IN ('A1','A2','B1','B2')),
    srs_interval   INTEGER NOT NULL DEFAULT 1,
    next_review_at TEXT    NOT NULL DEFAULT (date('now')),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fallback_words (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    french     TEXT NOT NULL UNIQUE,
    english    TEXT NOT NULL,
    cefr_level TEXT NOT NULL DEFAULT 'A1'
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT,
    total_questions INTEGER NOT NULL DEFAULT 10,
    correct_count   INTEGER NOT NULL DEFAULT 0,
    status          TEXT    NOT NULL DEFAULT 'in_progress'
                    CHECK(status IN ('in_progress','completed'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL REFERENCES quiz_sessions(id),
    question_num    INTEGER NOT NULL,
    word_id         INTEGER NOT NULL REFERENCES words(id),
    correct_answer  TEXT    NOT NULL,
    option_a        TEXT    NOT NULL,
    option_b        TEXT    NOT NULL,
    option_c        TEXT    NOT NULL,
    option_d        TEXT    NOT NULL,
    selected_answer TEXT,
    is_correct      INTEGER CHECK(is_correct IN (0,1)),
    answered_at     TEXT
);
```

---

## Validation Rules Summary

| Rule | Enforced by |
|------|-------------|
| Cannot start quiz with < 10 words | API: `GET /api/quiz/readiness` check |
| `cefr_level` restricted to A1/A2/B1/B2 | SQLite CHECK constraint |
| `status` restricted to in_progress/completed | SQLite CHECK constraint |
| `is_correct` restricted to 0 or 1 | SQLite CHECK constraint |
| Each question has exactly 4 distinct options | Application logic at session creation |
| `correct_answer` for each question must equal one of `option_a`, `option_b`, `option_c`, or `option_d` | Application logic at session creation (shuffle MUST include the correct answer — it is never dropped) |
| SRS interval capped at 30 days | Application logic in SRS update at session completion |
