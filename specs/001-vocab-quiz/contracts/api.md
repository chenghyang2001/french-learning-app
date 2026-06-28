# API Contract: Vocabulary Quiz

**Interface type**: REST API (JSON over HTTP)
**Base URL**: `http://localhost:3000/api`
**Date**: 2026-06-28

All responses use `Content-Type: application/json`.
All timestamps are ISO-8601 strings.
Error responses always include `{ "error": "<message>" }`.

---

## Readiness Check

### `GET /api/quiz/readiness`

Check whether the learner has enough words to start a quiz.

**Response 200 — enough words**:

```json
{
  "ready": true,
  "word_count": 42
}
```

**Response 200 — not enough words**:

```json
{
  "ready": false,
  "word_count": 7,
  "required": 10,
  "message": "You need 3 more words before you can take a quiz."
}
```

---

## Quiz Sessions

### `POST /api/quiz/sessions`

Create a new quiz session. Samples 10 words from learned vocabulary, selects
distractors, shuffles options, and persists all 10 questions.

**Request body**: none

**Response 201**:

```json
{
  "session_id": 5,
  "status": "in_progress",
  "total_questions": 10,
  "current_question": {
    "question_num": 1,
    "word_id": 23,
    "prompt": "bonjour",
    "options": {
      "a": "goodbye",
      "b": "hello",
      "c": "thank you",
      "d": "please"
    }
  }
}
```

**Response 400** — not enough words:

```json
{ "error": "Not enough learned words. Need at least 10, have 7." }
```

---

### `GET /api/quiz/sessions/:id`

Get current state of a session (supports resuming or checking status).

**Response 200**:

```json
{
  "session_id": 5,
  "status": "in_progress",
  "total_questions": 10,
  "answered_count": 3,
  "correct_count": 2,
  "current_question": {
    "question_num": 4,
    "word_id": 17,
    "prompt": "chat",
    "options": {
      "a": "dog",
      "b": "bird",
      "c": "cat",
      "d": "fish"
    }
  }
}
```

When `status` is `"completed"`, `current_question` is `null`.

**Response 404** — session not found:

```json
{ "error": "Session not found." }
```

---

### `POST /api/quiz/sessions/:id/answers`

Submit the learner's answer to the current unanswered question.

**Request body**:

```json
{ "selected": "b" }
```

`selected` must be one of `"a"`, `"b"`, `"c"`, `"d"`.

**Response 200 — correct answer**:

```json
{
  "question_num": 4,
  "is_correct": true,
  "correct_option": "c",
  "correct_answer": "cat",
  "session_complete": false,
  "next_question": {
    "question_num": 5,
    "word_id": 31,
    "prompt": "maison",
    "options": {
      "a": "school",
      "b": "car",
      "c": "house",
      "d": "garden"
    }
  }
}
```

**Response 200 — wrong answer**:

```json
{
  "question_num": 4,
  "is_correct": false,
  "correct_option": "c",
  "correct_answer": "cat",
  "selected_answer": "dog",
  "session_complete": false,
  "next_question": { ... }
}
```

**Response 200 — final question answered** (`session_complete: true`):

```json
{
  "question_num": 10,
  "is_correct": true,
  "correct_option": "a",
  "correct_answer": "house",
  "session_complete": true,
  "next_question": null
}
```

When `session_complete` is `true`, the session `status` is set to `"completed"`,
`completed_at` is recorded, and SRS intervals are updated for all 10 words.

**Response 400** — invalid option:

```json
{ "error": "Invalid option. Must be one of: a, b, c, d." }
```

**Response 400** — session already completed:

```json
{ "error": "Session is already completed." }
```

**Response 404** — session not found:

```json
{ "error": "Session not found." }
```

---

## Results & Review

### `GET /api/quiz/sessions/:id/results`

Get the final score for a completed session.

**Response 200**:

```json
{
  "session_id": 5,
  "status": "completed",
  "total_questions": 10,
  "correct_count": 8,
  "incorrect_count": 2,
  "percentage": 80,
  "started_at": "2026-06-28T10:00:00.000Z",
  "completed_at": "2026-06-28T10:04:30.000Z"
}
```

**Response 400** — session not yet completed:

```json
{ "error": "Session is not yet completed." }
```

---

### `GET /api/quiz/sessions/:id/missed`

Get the list of words answered incorrectly in a completed session.

**Response 200 — session has missed words**:

```json
{
  "session_id": 5,
  "missed_count": 2,
  "missed_words": [
    {
      "question_num": 4,
      "french": "chat",
      "correct_answer": "cat",
      "selected_answer": "dog"
    },
    {
      "question_num": 9,
      "french": "voiture",
      "correct_answer": "car",
      "selected_answer": "bus"
    }
  ]
}
```

**Response 200 — perfect score**:

```json
{
  "session_id": 5,
  "missed_count": 0,
  "missed_words": []
}
```

---

## Vocabulary (word management — referenced by quiz)

### `GET /api/words`

List all learned words with current SRS status.

**Query params** (optional):

| Param | Values | Default | Description |
|-------|--------|---------|-------------|
| `cefr` | A1, A2, B1, B2 | (all) | Filter by CEFR level |
| `due` | true | false | Only words due for review today |

**Response 200**:

```json
{
  "count": 42,
  "words": [
    {
      "id": 23,
      "french": "bonjour",
      "english": "hello",
      "cefr_level": "A1",
      "srs_interval": 4,
      "next_review_at": "2026-07-02"
    }
  ]
}
```

---

## Error Response Format

All error responses follow this shape:

```json
{ "error": "<human-readable message>" }
```

HTTP status codes used:

| Code | When |
|------|------|
| 200 | Success |
| 201 | Resource created |
| 400 | Invalid request (bad input, wrong state) |
| 404 | Resource not found |
| 500 | Unexpected server error |
