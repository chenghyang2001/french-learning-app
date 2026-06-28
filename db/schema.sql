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
    session_id      INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_num    INTEGER NOT NULL,
    word_id         INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    correct_answer  TEXT    NOT NULL,
    option_a        TEXT    NOT NULL,
    option_b        TEXT    NOT NULL,
    option_c        TEXT    NOT NULL,
    option_d        TEXT    NOT NULL,
    selected_answer TEXT,
    is_correct      INTEGER CHECK(is_correct IN (0,1)),
    answered_at     TEXT
);
