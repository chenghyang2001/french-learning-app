"use strict";
/**
 * api/quiz.js
 * 測驗相關 API Router
 *
 * 路由清單：
 *   GET  /readiness             - T013：詞彙就緒檢查
 *   GET  /sessions/:id          - T012d：取得 Session 詳情（不存在 → 404）
 *   POST /sessions              - T014：建立測驗 Session（含選項生成）
 *   POST /sessions/:id/answers  - T015：提交單題答案
 *
 * 依賴：express（Router）、api/db.js（getDb singleton）
 * DB 驅動：node:sqlite（DatabaseSync），無 better-sqlite3
 */

const express = require("express");
const router = express.Router();
const getDb = require("./db");

// ──────────────────────────────────────────────────────────────
// 工具函式
// ──────────────────────────────────────────────────────────────

/**
 * Fisher-Yates 原地洗牌
 * 比 .sort(() => Math.random() - 0.5) 分佈更均勻
 * @param {Array} arr - 要洗牌的陣列（原地修改）
 * @returns {Array} 同一陣列（已洗牌）
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * 為指定詞彙挑選干擾選項（三層降級策略）
 *
 * 第一層：words 表中相同 CEFR 且不同 id 的詞（最相關）
 * 第二層：fallback_words 同 CEFR（詞不夠時補充）
 * 第三層：fallback_words 任意詞（最後手段，確保一定能湊齊）
 *
 * 所有層都用 toLowerCase() 過濾重複，避免 "House" vs "house" 視為不同詞
 *
 * @param {Object} db - DatabaseSync 實例
 * @param {number} wordId - 當前詞彙 ID（排除自身）
 * @param {string} correctEnglish - 正確英文答案（同樣排除）
 * @param {string} cefrLevel - CEFR 等級（優先同等級）
 * @param {number} count - 需要幾個干擾選項（預設 3）
 * @returns {string[]} 干擾選項英文詞陣列（長度通常 >= count）
 */
function pickDistractors(db, wordId, correctEnglish, cefrLevel, count) {
  if (count === undefined) count = 3;
  const usedLower = new Set([correctEnglish.toLowerCase()]);
  const distractors = [];

  // 第一層：words 表同 CEFR，取 50 筆候選（排除正確答案字詞）
  const wordsRows = db
    .prepare(
      "SELECT english FROM words WHERE id != ? AND cefr_level = ? LIMIT 50",
    )
    .all(wordId, cefrLevel);

  for (let i = 0; i < wordsRows.length && distractors.length < count; i++) {
    const lower = wordsRows[i].english.toLowerCase();
    if (!usedLower.has(lower)) {
      usedLower.add(lower);
      distractors.push(wordsRows[i].english);
    }
  }

  if (distractors.length >= count) return distractors;

  // 第二層：fallback_words 同 CEFR，取 100 筆候選
  const fallbackSameCefr = db
    .prepare(
      "SELECT english FROM fallback_words WHERE cefr_level = ? LIMIT 100",
    )
    .all(cefrLevel);

  for (
    let i = 0;
    i < fallbackSameCefr.length && distractors.length < count;
    i++
  ) {
    const lower = fallbackSameCefr[i].english.toLowerCase();
    if (!usedLower.has(lower)) {
      usedLower.add(lower);
      distractors.push(fallbackSameCefr[i].english);
    }
  }

  if (distractors.length >= count) return distractors;

  // 第三層：fallback_words 任意詞（ORDER BY RANDOM() 增加多樣性）
  // 613 筆 fallback 確保一定能補齊剩餘缺口
  const fallbackAny = db
    .prepare("SELECT english FROM fallback_words ORDER BY RANDOM() LIMIT 200")
    .all();

  for (let i = 0; i < fallbackAny.length && distractors.length < count; i++) {
    const lower = fallbackAny[i].english.toLowerCase();
    if (!usedLower.has(lower)) {
      usedLower.add(lower);
      distractors.push(fallbackAny[i].english);
    }
  }

  return distractors;
}

/**
 * 計算新的 SRS 複習間隔
 * 正確：間隔加倍（上限 30 天）
 * 錯誤：重置為 1 天
 *
 * @param {number} currentInterval - 目前間隔（天數）
 * @param {boolean} isCorrect - 是否答對
 * @returns {number} 新間隔（天數）
 */
function computeNewInterval(currentInterval, isCorrect) {
  if (!isCorrect) return 1;
  return Math.min(currentInterval * 2, 30);
}

/**
 * 更新 Session 中所有詞彙的 SRS 間隔
 * 對每道題：計算新間隔 → UPDATE words SET srs_interval, next_review_at
 *
 * @param {Object} db - DatabaseSync 實例
 * @param {number} sessionId - 已完成的 Session ID
 */
function updateSrsForSession(db, sessionId) {
  const questions = db
    .prepare(
      "SELECT word_id, is_correct, (SELECT srs_interval FROM words WHERE id = word_id) AS srs_interval FROM quiz_questions WHERE session_id = ?",
    )
    .all(sessionId);

  const updateWord = db.prepare(
    "UPDATE words SET srs_interval = ?, next_review_at = date('now', ? || ' days') WHERE id = ?",
  );

  for (const q of questions) {
    const newInterval = computeNewInterval(q.srs_interval, q.is_correct === 1);
    updateWord.run(newInterval, String(newInterval), q.word_id);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /readiness
// T013：就緒檢查 — 詞彙是否達到 10 個可開始測驗
// ──────────────────────────────────────────────────────────────
router.get("/readiness", (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) AS cnt FROM words").get();
    const wordCount = row.cnt;
    const canStart = wordCount >= 10;

    const response = { can_start: canStart, word_count: wordCount };
    if (!canStart) {
      const needed = 10 - wordCount;
      response.message =
        `還需要再新增 ${needed} 個詞彙才能開始測驗` +
        `（目前 ${wordCount} 個，至少需要 10 個）`;
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /sessions/:id
// T012d：取得 Session 詳情，不存在時回 404
// ──────────────────────────────────────────────────────────────
router.get("/sessions/:id", (req, res) => {
  try {
    const db = getDb();
    const sessionId = Number(req.params.id);

    const session = db
      .prepare("SELECT * FROM quiz_sessions WHERE id = ?")
      .get(sessionId);

    // node:sqlite 找不到列時回傳 undefined（不是 null）
    if (session === undefined) {
      return res
        .status(404)
        .json({ error: `找不到 session id = ${sessionId}` });
    }

    return res.status(200).json({
      session_id: session.id,
      status: session.status,
      started_at: session.started_at,
      completed_at: session.completed_at,
      total_questions: session.total_questions,
      correct_count: session.correct_count,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /sessions
// T014：建立測驗 Session — 隨機選 10 題，每題 4 個唯一選項
// ──────────────────────────────────────────────────────────────
router.post("/sessions", (req, res) => {
  try {
    const db = getDb();

    // 詞彙不足 10 個時拒絕建立（需先累積足夠詞彙）
    const countRow = db.prepare("SELECT COUNT(*) AS cnt FROM words").get();
    if (countRow.cnt < 10) {
      return res.status(400).json({
        error: `詞彙數量不足（目前 ${countRow.cnt} 個，至少需要 10 個）`,
      });
    }

    // 從 words 隨機取 10 個詞彙作為題目來源
    const words = db
      .prepare("SELECT * FROM words ORDER BY RANDOM() LIMIT 10")
      .all();

    // 為每個詞彙準備選項（正確答案 + 3 個干擾選項 → 洗牌決定 a/b/c/d 位置）
    const questionData = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const distractors = pickDistractors(
        db,
        word.id,
        word.english,
        word.cefr_level,
        3,
      );
      if (distractors.length < 3) {
        throw new Error(
          `詞彙 "${word.french}"（id=${word.id}）僅找到 ${distractors.length} 個干擾選項，無法建立測驗`,
        );
      }

      // 合併正確答案與 3 個干擾選項後洗牌
      const options = shuffleArray([
        word.english,
        distractors[0],
        distractors[1],
        distractors[2],
      ]);

      questionData.push({
        word,
        correct_answer: word.english,
        option_a: options[0],
        option_b: options[1],
        option_c: options[2],
        option_d: options[3],
      });
    }

    // 建立 quiz_sessions + 10 道 quiz_questions（事務保護，防孤立 Session）
    db.exec("BEGIN");
    const sessionResult = db
      .prepare("INSERT INTO quiz_sessions(status) VALUES('in_progress')")
      .run();
    // lastInsertRowid 可能是 BigInt，強制轉為 Number 避免 JSON 序列化問題
    const sessionId = Number(sessionResult.lastInsertRowid);

    // 批次插入 quiz_questions，同時收集前端所需欄位
    const insertQuestion = db.prepare(
      `INSERT INTO quiz_questions
         (session_id, question_num, word_id, correct_answer,
          option_a, option_b, option_c, option_d)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const questions = [];
    for (let i = 0; i < questionData.length; i++) {
      const qd = questionData[i];
      const qResult = insertQuestion.run(
        sessionId,
        i + 1,
        qd.word.id,
        qd.correct_answer,
        qd.option_a,
        qd.option_b,
        qd.option_c,
        qd.option_d,
      );
      const questionId = Number(qResult.lastInsertRowid);

      // french_word 來自 words 物件（quiz_questions 表不存此欄位）
      questions.push({
        question_id: questionId,
        french_word: qd.word.french,
        option_a: qd.option_a,
        option_b: qd.option_b,
        option_c: qd.option_c,
        option_d: qd.option_d,
        correct_answer: qd.correct_answer,
      });
    }

    db.exec("COMMIT");
    return res.status(201).json({
      session_id: sessionId,
      status: "in_progress",
      questions,
    });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch (_) {
      /* 事務可能尚未開始，忽略 */
    }
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /sessions/:id/answers
// T015：提交單題答案 — 驗證、標記正誤、必要時完成 Session
// ──────────────────────────────────────────────────────────────
router.post("/sessions/:id/answers", (req, res) => {
  try {
    const db = getDb();
    const sessionId = Number(req.params.id);
    const { question_id, selected_option } = req.body;

    // 驗證 selected_option 必須是 a/b/c/d 其中之一
    const validOptions = ["a", "b", "c", "d"];
    if (!validOptions.includes(selected_option)) {
      return res.status(400).json({
        error: `selected_option 必須是 'a'、'b'、'c' 或 'd'，收到：${selected_option}`,
      });
    }

    // 確認 Session 存在
    const session = db
      .prepare("SELECT * FROM quiz_sessions WHERE id = ?")
      .get(sessionId);
    if (session === undefined) {
      return res
        .status(404)
        .json({ error: `找不到 session id = ${sessionId}` });
    }

    // Session 已完成時拒絕繼續作答（防止重刷分數）
    if (session.status === "completed") {
      return res.status(400).json({ error: "Session already completed" });
    }

    // 確認題目存在且屬於此 Session（防止跨 Session 作弊）
    const question = db
      .prepare("SELECT * FROM quiz_questions WHERE id = ? AND session_id = ?")
      .get(question_id, sessionId);
    if (question === undefined) {
      return res.status(404).json({
        error: `找不到 question id = ${question_id}（session ${sessionId}）`,
      });
    }

    // 已作答的題目不允許重複提交（selected_answer 為 NULL 表示未答）
    if (
      question.selected_answer !== null &&
      question.selected_answer !== undefined
    ) {
      return res.status(400).json({ error: "此題已作答，不可重複提交" });
    }

    // 判斷選擇的選項值是否等於正確答案
    const selectedValue = question[`option_${selected_option}`];
    const isCorrectBool = selectedValue === question.correct_answer;
    const isCorrectInt = isCorrectBool ? 1 : 0;

    // 找出正確答案對應的選項字母（供前端高亮顯示正確選項）
    let correctOption = null;
    for (let i = 0; i < validOptions.length; i++) {
      if (question[`option_${validOptions[i]}`] === question.correct_answer) {
        correctOption = validOptions[i];
        break;
      }
    }

    // 更新題目作答記錄
    db.prepare(
      `UPDATE quiz_questions
       SET selected_answer = ?, is_correct = ?, answered_at = datetime('now')
       WHERE id = ?`,
    ).run(selected_option, isCorrectInt, question_id);

    // 檢查 Session 是否全部答完（含本題更新後）
    const answeredRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM quiz_questions
         WHERE session_id = ? AND selected_answer IS NOT NULL`,
      )
      .get(sessionId);
    const totalRow = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM quiz_questions WHERE session_id = ?",
      )
      .get(sessionId);

    if (answeredRow.cnt === totalRow.cnt) {
      // 計算最終正確數量（含剛才這題），標記 Session 完成
      const correctCountRow = db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM quiz_questions
           WHERE session_id = ? AND is_correct = 1`,
        )
        .get(sessionId);

      db.prepare(
        `UPDATE quiz_sessions
         SET status = 'completed', completed_at = datetime('now'), correct_count = ?
         WHERE id = ?`,
      ).run(correctCountRow.cnt, sessionId);

      // T027：Session 完成時批次更新所有詞彙的 SRS 間隔
      updateSrsForSession(db, sessionId);
    }

    return res.status(200).json({
      is_correct: isCorrectBool,
      correct_option: correctOption,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /sessions/:id/results
// T020b：取得已完成 Session 的分數統計
// 未完成時回 400，不存在回 404
// ──────────────────────────────────────────────────────────────
router.get("/sessions/:id/results", (req, res) => {
  try {
    const db = getDb();
    const sessionId = Number(req.params.id);

    // 查詢 session，不存在回 404
    const session = db
      .prepare("SELECT * FROM quiz_sessions WHERE id = ?")
      .get(sessionId);
    if (session === undefined) {
      return res
        .status(404)
        .json({ error: `找不到 session id = ${sessionId}` });
    }

    // 尚未完成時回 400（只有 completed 狀態才能查結果）
    if (session.status !== "completed") {
      return res.status(400).json({ error: "測驗尚未完成，無法查詢結果" });
    }

    // 計算答錯題數（is_correct = 0）
    const incorrectRow = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM quiz_questions WHERE session_id = ? AND is_correct = 0",
      )
      .get(sessionId);
    const incorrectCount = incorrectRow.cnt;

    // 四捨五入至整數百分比
    const percentage = Math.round(
      (session.correct_count / session.total_questions) * 100,
    );

    return res.status(200).json({
      session_id: sessionId,
      total_questions: session.total_questions,
      correct_count: session.correct_count,
      incorrect_count: incorrectCount,
      percentage,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /sessions/:id/missed
// T020c：取得答錯的詞彙清單
// 不存在回 404；completed/in_progress 皆可查（未答題不出現）
// ──────────────────────────────────────────────────────────────
router.get("/sessions/:id/missed", (req, res) => {
  try {
    const db = getDb();
    const sessionId = Number(req.params.id);

    // 查詢 session，不存在回 404
    const session = db
      .prepare("SELECT * FROM quiz_sessions WHERE id = ?")
      .get(sessionId);
    if (session === undefined) {
      return res
        .status(404)
        .json({ error: `找不到 session id = ${sessionId}` });
    }

    // JOIN quiz_questions 與 words，篩出 is_correct = 0 的題目
    // ORDER BY question_num 確保回傳順序與作答順序一致
    const missed = db
      .prepare(
        `SELECT w.french, qq.correct_answer, qq.selected_answer
         FROM quiz_questions qq
         JOIN words w ON w.id = qq.word_id
         WHERE qq.session_id = ? AND qq.is_correct = 0
         ORDER BY qq.question_num ASC`,
      )
      .all(sessionId);

    return res.status(200).json({
      missed_count: missed.length,
      missed_words: missed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// T028：匯出 computeNewInterval 供測試直接呼叫（純函式，無副作用）
router.computeNewInterval = computeNewInterval;

module.exports = router;
