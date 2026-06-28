# Pre-Implementation Gate Checklist: Vocabulary Quiz

**Purpose**: Validate that all requirements are precise enough to write failing tests
before any implementation code is written (Constitution Principle III gate).
Full-breadth coverage: spec.md + plan.md + tasks.md + contracts/api.md.
**Created**: 2026-06-28
**Feature**: [spec.md](../spec.md)
**Gate**: ALL items in Category 1 (TDD Readiness) MUST be checked before starting T011.
Remaining categories SHOULD be resolved; open items become tracked risks.

---

## Category 1 — TDD Readiness (MANDATORY GATE) ⛔ Must all pass before T011

*Are requirements precise enough to write a failing `node:test` assertion right now?*

- [x] CHK001 — Is the quiz start threshold (10 words) stated as a single unambiguous integer
  that maps directly to a `assert.equal(result.word_count >= 10, true)` assertion,
  with no conditional wording that could make the threshold variable? [TDD Gate, Spec §FR-001]
  → ✅ PASS: FR-001 states "≥ 10 learned French words" — single integer constant, no branching.

- [x] CHK002 — Is "10 questions by default" in FR-002 precise enough to write a test that
  asserts `quiz_questions.length === 10` — or does "by default" imply a configurable
  parameter that test setup must account for? [TDD Gate, Clarity, Spec §FR-002]
  → ✅ FIXED (2026-06-28): "by default" contradicted Assumptions ("fixed, configurable out of scope").
  FR-002 now reads "exactly 10 questions". Assertion `questions.length === 10` is unambiguous.

- [x] CHK003 — For FR-003 distractor selection, is the priority rule ("same-CEFR first,
  supplement from fallback_words if fewer than 3") stated with a precise threshold
  ("fewer than 3 **other** words at the same CEFR level") that can drive a deterministic
  test with controlled seed data? [TDD Gate, Algorithm Clarity, Spec §FR-003]
  → ✅ FIXED (2026-06-28): FR-003 previously said "fewer than 3 other learned words" (any CEFR),
  conflicting with data-model.md ("fewer than 3 returned from same-CEFR query"). Now reads
  "fewer than 3 other learned words of the same CEFR level are available".

- [x] CHK004 — Is the SRS update formula (correct → `MIN(interval×2, 30)`, incorrect → `1`)
  expressed in a way that yields exact numeric input/output pairs for a pure function test
  (e.g., `srs(4, true) === 8`, `srs(4, false) === 1`, `srs(20, true) === 30`)? [TDD Gate,
  Spec §FR-008, data-model.md §SRS update rules]
  → ✅ PASS: Formula is precise in data-model.md §SRS update rules. srs.test.js references
  that document. FR-008 prose is vague but data-model.md is the authoritative technical source.

- [x] CHK005 — Is the distractor uniqueness invariant (no duplicate English strings among
  option_a–option_d) explicitly stated as a requirement in FR-003 or data-model.md, not
  merely implied — making it possible to write `assert.equal(new Set(opts).size, 4)`?
  [TDD Gate, Gap — addressed by tasks.md T012(e)]
  → ✅ PASS: Spec §Edge Cases states "the system MUST still produce 4 unique options per
  question". MUST sentence present; `new Set(opts).size === 4` has explicit basis.

- [x] CHK006 — Is the correct-answer-in-options invariant (correct_answer must equal exactly
  one of option_a–option_d) explicitly stated as a requirement, enabling
  `assert.ok([q.option_a, q.option_b, q.option_c, q.option_d].includes(q.correct_answer))`?
  [TDD Gate, Gap — addressed by tasks.md T012(f)]
  → ✅ FIXED (2026-06-28): Invariant was only implicit in algorithm description. Added explicit
  row to data-model.md §Validation Rules: "`correct_answer` must equal one of option_a/b/c/d".

- [x] CHK007 — Are the HTTP error codes (400/404/500) and response body shapes for each
  API endpoint in contracts/api.md precise enough that failing tests can assert both
  status code AND body schema before any handler code exists? [TDD Gate, Contracts]
  → ✅ PASS: contracts/api.md defines status codes + `{ "error": "..." }` shapes for all
  failure modes (400 invalid option, 400 session complete, 400 not enough words, 404 not found).

- [x] CHK008 — Is the fallback path trigger condition (fewer than 3 same-CEFR words)
  deterministically testable with the seed data in `db/seed-test.js` — i.e., does the
  seed data include at least one CEFR level with fewer than 3 words, or must seed-test.js
  be specifically designed to create this condition? [TDD Gate, Spec §FR-003, tasks.md T009]
  → ✅ FIXED (2026-06-28): T009 (seed-test.js task) previously said "at least two CEFR levels"
  without guaranteeing any level has < 3 words. Now specifies: ≥ 12 A1 words + exactly 1 B2
  word, so T012(g) can reliably trigger the fallback path by using the B2 quiz word.

---

## Category 2 — Requirement Completeness

*Are all necessary requirements documented?*

- [ ] CHK009 — Are requirements defined for what the system shows when the learner
  reopens the app after closing mid-session (partial in-progress session) — or is the
  "progress is lost" behavior explicitly documented as the intended UX? [Completeness,
  Edge Case, Spec §Edge Cases]

- [ ] CHK010 — Does FR-009 (< 10 words message) specify the exact content elements the
  message MUST contain (current count, required count, path to add words), or is the
  wording left entirely to implementation discretion? [Completeness, Clarity, Spec §FR-009]

- [ ] CHK011 — Are requirements defined for what happens when `POST /api/quiz/sessions`
  is called but the DB write fails mid-session (e.g., after inserting quiz_sessions but
  before inserting all 10 quiz_questions rows) — is atomicity required? [Completeness,
  Exception Flow, Gap]

- [ ] CHK012 — Does FR-008 specify the timing of SRS updates — do they occur synchronously
  within the same request that sets `session_complete=true`, or may they be deferred?
  [Completeness, Clarity, Spec §FR-008, contracts/api.md]

- [ ] CHK013 — Is there a requirement defining the word sampling strategy for quiz questions
  (uniformly random from ALL learned words, or only words "due for review" per SRS schedule)?
  [Completeness, Gap, Spec §FR-001]

- [ ] CHK014 — Are requirements defined for what happens when `POST /api/quiz/sessions/:id/answers`
  receives a duplicate submission for an already-answered question (race condition or
  double-click)? [Completeness, Exception Flow, Gap]

---

## Category 3 — Requirement Clarity

*Are vague terms quantified and unambiguous?*

- [ ] CHK015 — Is "immediately reveal" in FR-004 explicitly cross-referenced to SC-002's
  1-second threshold, or could "immediately" be interpreted as a different latency target
  by an implementer reading only FR-004? [Clarity, Consistency, Spec §FR-004 ↔ §SC-002]

- [ ] CHK016 — Is "encouraging message" in FR-009 defined with tone constraints (e.g.,
  "MUST NOT use negative language" per Constitution Principle I: "Error messages MUST be
  encouraging, never punishing") or is the tone requirement only implicit? [Clarity,
  Spec §FR-009, Constitution §I]

- [ ] CHK017 — Are the terms "learned French words" (FR-001, FR-003) and "words" (data-model.md
  table) definitionally equivalent — is there a single stated definition of what qualifies
  a word as "learned"? [Clarity, Consistency, Spec §Assumptions, data-model.md]

- [ ] CHK018 — Is "built-in fallback vocabulary list" in FR-003 cross-referenced to
  `fallback_words` table and `db/seed-fallback.sql` so an implementer does not need to
  read both spec.md and plan.md to understand what "built-in" means? [Clarity,
  Spec §FR-003, plan.md]

- [ ] CHK019 — Is option shuffling (randomizing which lettered slot a/b/c/d receives the
  correct answer) specified as an explicit requirement, or is it implied by "one correct,
  three distractors"? [Clarity, Gap, data-model.md §Distractor selection algorithm step 2]

---

## Category 4 — Algorithm Specification Quality

*Are FR-003 (distractor) and FR-008 (SRS) complete enough for unambiguous implementation?*

- [ ] CHK020 — Is the CEFR matching rule for distractors precisely defined as strict equality
  (`word.cefr_level = distractor.cefr_level`) rather than adjacency — eliminating the
  ambiguity of whether A1 and A2 words count as "same level"? [Algorithm Clarity,
  Spec §FR-003, data-model.md]

- [ ] CHK021 — Is there a stated requirement for the fallback_words fallback scenario when
  the personal pool has < 3 same-CEFR words AND the fallback pool also has few words of
  that level — does the system accept any CEFR level from fallback_words, or only the
  exact same level? [Algorithm Completeness, Spec §FR-003]

- [ ] CHK022 — Is the SRS cap value of 30 days stated in spec.md (FR-008) or only in
  data-model.md — is there a single authoritative source so the constant cannot diverge?
  [Algorithm Traceability, Spec §FR-008, data-model.md §SRS update rules]

- [ ] CHK023 — Is the SRS formula consistent across the three documents that state it:
  spec.md FR-008, data-model.md §SRS update rules, and research.md Decision 6? [Consistency,
  Algorithm Traceability]

- [ ] CHK024 — Is the question word sampling strategy (random from `words` table) described
  in data-model.md §Distractor selection algorithm consistent with what FR-002 implies —
  no additional filters (e.g., excluding recently quizzed words)? [Algorithm Consistency,
  data-model.md, Spec §FR-002]

---

## Category 5 — API Contract Completeness

*Are all contracts/api.md endpoints fully specified for all states?*

- [ ] CHK025 — Does the `GET /api/quiz/sessions/:id` contract explicitly state that
  `current_question` is `null` when `status === "completed"` — preventing ambiguous
  implementations that might omit the key or set it to `{}`? [Completeness,
  Contracts §GET /api/quiz/sessions/:id]

- [ ] CHK026 — Are error responses specified for `GET /api/quiz/sessions/:id/missed` when
  the session is still `in_progress` — the contract shows success cases but does not
  explicitly define the 400 response for incomplete sessions? [Completeness, Contracts §GET missed]

- [ ] CHK027 — Is idempotency behavior specified for `POST /api/quiz/sessions` — what does
  the API return if called twice in rapid succession (two new sessions, or an error)?
  [Completeness, Exception Flow, Contracts §POST /api/quiz/sessions]

- [ ] CHK028 — Are rate-limiting or concurrent-request requirements defined for the quiz
  API, or is the single-user local context explicitly stated as the reason they are omitted?
  [Completeness, NFR, Gap]

- [ ] CHK029 — Does the `POST /api/quiz/sessions/:id/answers` contract specify what the
  `correct_option` field contains when `is_correct` is `true` — is it always included or
  only when the answer was wrong? [Clarity, Contracts §POST answers]

---

## Category 6 — Scenario Coverage

*Are primary, alternate, exception, and recovery flows specified?*

- [ ] CHK030 — Are alternate flow requirements specified for a learner whose entire vocabulary
  is at a single CEFR level — does same-CEFR distractor selection work when all words share
  one level and 9 distractors are available from the same pool? [Coverage, Alternate Flow,
  Spec §FR-003]

- [ ] CHK031 — Is there a requirement for the UI state after the "Review Missed Words" list
  is viewed — can the learner return to the results screen, or is the review a terminal
  state? [Coverage, Alternate Flow, Spec §FR-007]

- [ ] CHK032 — Are requirements defined for retaking a quiz immediately (FR spec mentions
  "retakes unlimited times") — does `POST /api/quiz/sessions` always create a fresh session,
  even if a previous session exists in-progress? [Coverage, Alternate Flow, Spec §Assumptions]

- [ ] CHK033 — Does FR-006 specify that the "Review Missed Words" button is absent (not merely
  disabled) when score is 100% — or is hiding vs. disabling left to implementation? [Coverage,
  Clarity, Spec §FR-006]

---

## Category 7 — Non-Functional Requirements

*Performance, accessibility, and offline behavior*

- [ ] CHK034 — Is SC-002 (feedback < 1 second) consistent with Constitution Principle I
  ("Progress feedback MUST be immediate (< 200 ms visual response)") — or is the 5× looser
  threshold for quiz feedback intentionally justified somewhere? [Consistency, NFR,
  Spec §SC-002, Constitution §I]

- [ ] CHK035 — Are accessibility requirements for the quiz interaction defined beyond
  "keyboard accessible" — e.g., ARIA role for option buttons, focus management after
  answer feedback, screen reader announcement of correct/incorrect result? [NFR, Coverage,
  Constitution §I]

- [ ] CHK036 — Is SC-005 (< 500 ms for 1000+ words) the only performance requirement, or
  are there requirements for initial DB initialization time when `seed-fallback.sql`
  inserts 500 rows on first run? [NFR Completeness, Spec §SC-005, plan.md]

- [ ] CHK037 — Is the offline-only constraint (no external network calls, no CDN assets)
  stated as an explicit requirement in spec.md or only as a plan.md constraint — would
  an implementer reading only the spec know that `<link rel="stylesheet" href="cdn...">`
  is prohibited? [NFR, Completeness, plan.md §Constraints]

---

## Category 8 — Dependencies & Assumptions

*Are cross-document assumptions validated and consistent?*

- [ ] CHK038 — Is the "≥ 500 fallback words" assumption (Spec §Assumptions) validated by
  a verifiable artifact — does `db/seed-fallback.sql` (referenced in plan.md) have a
  stated row count, or is the 500-word guarantee unverified? [Assumption, Spec §Assumptions,
  plan.md]

- [ ] CHK039 — Is the "learned words" definition in Spec §Assumptions ("at least one
  successful study session") consistent with the `words` table schema — which has no
  study-session column and treats every row as a learned word? [Assumption Conflict,
  Spec §Assumptions, data-model.md §Word entity]

- [ ] CHK040 — Are the Node.js 18+ prerequisites stated consistently in quickstart.md
  §Prerequisites AND plan.md §Technical Context — would a fresh developer reading only
  quickstart.md know the exact version floor? [Dependency, Consistency, quickstart.md,
  plan.md]

---

## Category 9 — Cross-Document Consistency (spec ↔ plan ↔ tasks)

*No terminology drift or coverage gaps between the three core artifacts*

- [ ] CHK041 — Does every FR-### in spec.md map to at least one task in tasks.md?
  Specifically, does FR-009 (encouraging message for < 10 words) have an explicit
  implementation task, or is it only implicitly covered by T013 (readiness handler)?
  [Traceability, Spec ↔ Tasks]

- [ ] CHK042 — Does the `GET /api/quiz/sessions/:id` endpoint in contracts/api.md have a
  corresponding implementation task? (The `/speckit-analyze` report flagged M2 — this
  item confirms whether that gap is still unresolved in tasks.md.) [Traceability,
  Contracts ↔ Tasks, M2 from analyze]

- [ ] CHK043 — Is the distractor algorithm described in data-model.md §Distractor selection
  algorithm consistent with research.md §Decision 5 — do both documents agree on the
  exact fallback trigger condition and pool source? [Consistency, data-model.md ↔ research.md]

- [ ] CHK044 — Do the API client wrapper function names in tasks.md T016 (`checkReadiness`,
  `createSession`, `submitAnswer`, `getResults`, `getMissed`) map 1:1 to the endpoints
  in contracts/api.md — no function covers a missing endpoint, no endpoint lacks a
  client wrapper? [Consistency, tasks.md T016 ↔ Contracts]

- [ ] CHK045 — Is there a single source of truth for the SRS formula — does the same
  formula appear in spec.md FR-008, data-model.md §SRS update rules, and research.md
  §Decision 6 without divergence? [Consistency, Traceability]

---

## Notes

- Check items off as completed: `[x]`
- Items marked **[Gap]** indicate a missing requirement — add to spec.md or document as
  intentional exclusion in plan.md Complexity Tracking
- Items marked **[Ambiguity]** require a wording fix in the source document
- Items marked **[Assumption Conflict]** require either schema change or assumption update
- Category 1 (CHK001–CHK008) is a hard gate: do not start T011 until all 8 are ✅
- Add inline notes with findings: `- [x] CHK003 ✅ Confirmed: threshold "fewer than 3" in data-model.md line 101`
