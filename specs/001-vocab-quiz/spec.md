# Feature Specification: Vocabulary Quiz

**Feature Branch**: `001-vocab-quiz`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: "我想要新建一个单词测验的功能 让使用者可以透过选择题来测试他们学过的法语单词"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a Quiz Session (Priority: P1)

A learner who has accumulated at least 10 French vocabulary words starts a
quiz session. The system presents French words one at a time; for each word
the learner selects the correct English translation from four options. After
answering, the learner immediately sees whether they were right or wrong, along
with the correct answer if they erred. After the final question, the learner
sees their overall score (e.g., "8 / 10 correct").

**Why this priority**: This is the entire core value of the feature.
Without a working quiz session, nothing else matters.

**Independent Test**: Open the quiz, answer 10 questions, verify a score screen
appears with the correct count. Can be tested with any user who has ≥ 10 learned words.

**Acceptance Scenarios**:

1. **Given** a learner with ≥ 10 learned words, **When** they start a quiz,
   **Then** the system presents exactly 10 questions (default length) drawn
   from their learned vocabulary, each with 1 correct and 3 distractor options.

2. **Given** a question is displayed, **When** the learner selects an answer,
   **Then** immediate visual feedback shows correct (green) or incorrect (red),
   and the correct answer is highlighted before moving to the next question.

3. **Given** the learner completes all questions, **When** the final answer is
   submitted, **Then** a results screen shows total score, percentage, and a
   count of correct vs. incorrect answers.

4. **Given** a learner has fewer than 10 learned words, **When** they attempt
   to start a quiz, **Then** the system shows an encouraging message explaining
   the minimum requirement and links to the vocabulary learning section.

---

### User Story 2 - Review Missed Words After Quiz (Priority: P2)

After completing a quiz session, the learner can view a summary of every word
they answered incorrectly, along with the correct English translation and the
wrong answer they selected.

**Why this priority**: Reviewing errors immediately after a quiz is a proven
learning technique. Without review, the quiz provides a score but no insight.

**Independent Test**: Complete a quiz with at least one wrong answer, then
navigate to the review screen and confirm all missed words are listed with
correct answers.

**Acceptance Scenarios**:

1. **Given** a completed quiz session with ≥ 1 incorrect answer, **When** the
   learner taps "Review Missed Words" on the results screen, **Then** they see
   a list of each missed word paired with the correct English translation and
   the learner's wrong answer.

2. **Given** a completed quiz with all answers correct, **When** the results
   screen is shown, **Then** the "Review Missed Words" option is hidden or
   disabled, and a congratulatory message is displayed instead.

---

### User Story 3 - Quiz Updates Spaced Repetition Schedule (Priority: P3)

Quiz performance feeds back into the learner's spaced repetition schedule:
correctly answered words move to a longer review interval; incorrectly answered
words are scheduled for earlier review.

**Why this priority**: This closes the loop between testing and learning per
the project's Progressive Skill Architecture principle. Without this, the quiz
is isolated from the learner's overall progress system.

**Independent Test**: Answer a word correctly in a quiz, then verify its next
review date has been pushed forward. Answer a different word incorrectly, verify
its review date has been moved to sooner.

**Acceptance Scenarios**:

1. **Given** a word answered correctly during a quiz, **When** the quiz session
   ends, **Then** that word's next scheduled review date is extended (interval
   increases by one step in the SRS schedule).

2. **Given** a word answered incorrectly during a quiz, **When** the quiz session
   ends, **Then** that word's next scheduled review date is reset to within
   24 hours (interval resets to the shortest step).

---

### Edge Cases

- What happens when a learner starts a quiz but closes the browser mid-session?
  → Progress for the current session is lost; the learner can start a fresh quiz.
  Partial sessions do not affect the SRS schedule.
- What if only 10–12 words are learned, making distractor selection difficult?
  → Distractors may repeat across questions if the pool is small; the system
  MUST still produce 4 unique options per question (padding with common French
  vocabulary from a built-in fallback list if necessary).
- What if a learner retakes the same quiz immediately?
  → A new session is created each time; questions are re-sampled from the full
  learned vocabulary pool.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow any learner with ≥ 10 learned French words
  to start a vocabulary quiz session. *(Authentication is not required for this
  local single-user deployment — see Assumptions below and plan.md Complexity
  Tracking for rationale.)*
- **FR-002**: Each quiz session MUST present exactly 10 questions; each
  question MUST show one French word and four answer options (one correct,
  three distractors). *(Quiz length is fixed at 10 for this version;
  configurable length is explicitly out of scope — see Assumptions.)*
- **FR-003**: Distractor options MUST be drawn from the learner's own learned
  vocabulary pool, preferring words of the same CEFR level as the quiz word;
  if fewer than 3 other learned words of the same CEFR level are available,
  the system MUST supplement from a built-in fallback vocabulary list.
- **FR-004**: After each answer is submitted, the system MUST immediately reveal
  whether the answer was correct or incorrect and highlight the correct option
  before the learner can proceed.
- **FR-005**: Upon session completion, the system MUST display a results screen
  showing: total questions, correct count, incorrect count, and percentage score.
- **FR-006**: The results screen MUST provide access to a missed-words review
  list for sessions with ≥ 1 incorrect answer.
- **FR-007**: The missed-words review list MUST show each missed French word,
  its correct English translation, and the wrong answer the learner selected.
- **FR-008**: On session completion, the system MUST update the SRS review
  schedule for every word that appeared in the quiz (correct → longer interval;
  incorrect → reset to shortest interval).
- **FR-009**: A learner with fewer than 10 learned words MUST see an
  informational message when attempting to start a quiz, including the current
  word count and the minimum required.
- **FR-010**: Quiz questions MUST be shown in the direction: French word →
  learner selects correct English translation.

### Key Entities *(include if feature involves data)*

- **QuizSession**: Represents one quiz attempt. Attributes: session ID, learner
  ID, start time, end time, status (in-progress / completed), total questions,
  correct count.
- **QuizQuestion**: One question within a session. Attributes: question number,
  French word (prompt), correct answer, three distractor options, learner's
  selected answer, answered timestamp.
- **LearnedWord**: A French vocabulary entry the learner has previously studied.
  Attributes: French term, English translation, CEFR level, SRS interval, next
  review date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can start a quiz and receive a final score within 5 minutes
  of initiating the session (assumes standard 10-question quiz).
- **SC-002**: Immediate answer feedback (correct / incorrect highlight) appears
  within 1 second of the learner selecting an option.
- **SC-003**: 90% of learners who complete a quiz can locate the missed-words
  review without additional guidance (zero extra taps beyond the results screen).
- **SC-004**: After 4 weeks of regular quiz usage, learners' quiz scores on
  previously failed words improve by ≥ 20 percentage points on re-test (SRS
  effectiveness metric).
- **SC-005**: The quiz feature is fully functional for learners with vocabulary
  pools ranging from 10 to 1,000+ words without performance degradation
  (question load time < 500 ms in all cases).

## Assumptions

- **No authentication required**: This feature targets a local single-user deployment where running on `localhost:3000` is the only access control needed. Authentication (login screen, password hashing, session cookies) was omitted as a deliberate YAGNI decision documented in plan.md Complexity Tracking; the original wording in FR-001 ("authenticated learner") referred to a multi-user cloud context that is out of scope for this version.
- "Learned words" are defined as vocabulary items the learner has previously
  completed at least one successful study session for (exact threshold deferred
  to the vocabulary learning feature definition).
- The default quiz direction is French → English (recognition); English → French
  (recall / production mode) is out of scope for this version.
- Quiz length is fixed at 10 questions for the initial version; configurable
  length is out of scope.
- Audio pronunciation of French words during the quiz is out of scope for this version.
- Learners may retake quizzes unlimited times; no cooldown period is enforced.
- The built-in fallback vocabulary list (for distractor padding) contains at
  least 500 common French words at A1–A2 CEFR level and is bundled with the application.
