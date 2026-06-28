"use strict";
/**
 * tests/quiz.test.js
 *
 * TDD 紅色階段：目前 routes 是空 stub，所有測試應 FAIL（stub 回 404）。
 * 實作完成後所有測試應 PASS。
 *
 * 技術棧：node:test + node:assert/strict + node:sqlite（零額外依賴）
 * DB 隔離：頂層設定 process.env.DB_PATH，確保在 require 路由前生效
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const http = require("node:http");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

// ──────────────────────────────────────────────────────────────
// DB 隔離設定
// 必須在 require api/* 之前執行：api/db.js 在模組載入時就讀取 DB_PATH
// ──────────────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `french-quiz-test-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

const SCHEMA_PATH = path.join(__dirname, "..", "db", "schema.sql");
const SEED_FALLBACK_PATH = path.join(
  __dirname,
  "..",
  "db",
  "seed-fallback.sql",
);

// 測試種子詞彙：13 A1 + 1 A2 + 1 B2 = 15 個
// 只有 1 個 B2（epanouissement），確保 T012g 測試 fallback_words 補充選項的路徑
const TEST_WORDS = [
  ["maison", "house", "A1"],
  ["chat", "cat", "A1"],
  ["chien", "dog", "A1"],
  ["livre", "book", "A1"],
  ["eau", "water", "A1"],
  ["pain", "bread", "A1"],
  ["rouge", "red", "A1"],
  ["bleu", "blue", "A1"],
  ["un", "one", "A1"],
  ["deux", "two", "A1"],
  ["table", "table", "A1"],
  ["chaise", "chair", "A1"],
  ["fenetre", "window", "A1"],
  ["acheter", "to buy", "A2"],
  ["epanouissement", "fulfillment", "B2"],
];

// ──────────────────────────────────────────────────────────────
// 輔助函式
// ──────────────────────────────────────────────────────────────

/**
 * 初始化測試 DB：建立 schema → 匯入 fallback seed（613 筆）→ 插入測試詞彙
 * 必須在啟動 HTTP server 之前呼叫
 */
function initTestDb() {
  const db = new DatabaseSync(TEST_DB);
  try {
    // 建立 4 個 table（words / fallback_words / quiz_sessions / quiz_questions）
    db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    // 匯入 fallback_words 干擾選項池，供 B2 等詞不足時補充
    db.exec(fs.readFileSync(SEED_FALLBACK_PATH, "utf8"));
    // 批次插入測試詞彙到 words table
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO words(french, english, cefr_level) VALUES(?,?,?)",
    );
    db.exec("BEGIN");
    for (const [french, english, level] of TEST_WORDS) {
      stmt.run(french, english, level);
    }
    db.exec("COMMIT");
  } finally {
    db.close();
  }
}

/**
 * 還原 words table 到完整的 15 個測試詞彙
 * 供 T011b / T012g 的 finally 區塊使用，確保測試失敗時也能還原
 */
function restoreTestWords() {
  const db = new DatabaseSync(TEST_DB);
  try {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO words(french, english, cefr_level) VALUES(?,?,?)",
    );
    db.exec("BEGIN");
    for (const [french, english, level] of TEST_WORDS) {
      stmt.run(french, english, level);
    }
    db.exec("COMMIT");
  } finally {
    db.close();
  }
}

/**
 * 建立僅含路由的 Express app（不呼叫 listen）
 * 避免 import server.js 導致雙重 listen 與 port 衝突
 */
function buildTestApp() {
  const express = require("express");
  const app = express();
  app.use(express.json());
  // 在設定 DB_PATH 後才 require，確保 api/db.js singleton 讀到正確路徑
  app.use("/api/quiz", require("../api/quiz"));
  app.use("/api/words", require("../api/words"));
  return app;
}

/**
 * 發送 HTTP 請求至測試 server，回傳 { status, body }
 * 若回應非 JSON（如 Express 預設 404 HTML），body 為 {} 讓斷言正常失敗
 */
async function request(server, method, urlPath, reqBody = null) {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${urlPath}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (reqBody !== null) {
    opts.body = JSON.stringify(reqBody);
  }
  const res = await fetch(url, opts);
  let body;
  try {
    body = await res.json();
  } catch (_) {
    // 空 stub 可能回傳 HTML 404，無法解析 JSON → 傳空物件使斷言失敗
    body = {};
  }
  return { status: res.status, body };
}

// ──────────────────────────────────────────────────────────────
// Test Suite
// ──────────────────────────────────────────────────────────────

describe("French Quiz API", () => {
  let server;

  before(() => {
    // 1. 建立測試 DB（schema + fallback seed + 15 個測試詞彙）
    initTestDb();
    // 2. 啟動測試 server（隨機 port，避免與 dev server 衝突）
    const app = buildTestApp();
    server = http.createServer(app);
    return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try {
          fs.unlinkSync(TEST_DB);
        } catch (_) {
          // CI 環境可能已清理，忽略刪除失敗
        }
        resolve();
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // T011: GET /api/quiz/readiness — 單詞數量就緒檢查
  // ────────────────────────────────────────────────────────────

  describe("T011 readiness endpoint", () => {
    it("T011a: 15 個詞時回傳 200 { can_start: true, word_count: 15 }", async () => {
      const { status, body } = await request(
        server,
        "GET",
        "/api/quiz/readiness",
      );
      assert.equal(status, 200);
      assert.equal(body.can_start, true);
      assert.equal(body.word_count, 15);
    });

    it("T011b: 1 個詞時回傳 200 { can_start: false, word_count: 1, message: <非空字串> }", async () => {
      // 讀取所有 word id，保留第 1 個，刪除其餘
      const dbRead = new DatabaseSync(TEST_DB);
      const allIds = dbRead
        .prepare("SELECT id FROM words")
        .all()
        .map((r) => r.id);
      dbRead.close();

      // 同步執行刪除，確保在 HTTP 請求前完成
      const dbWrite = new DatabaseSync(TEST_DB);
      try {
        dbWrite.exec("BEGIN IMMEDIATE");
        for (const id of allIds.slice(1)) {
          dbWrite.prepare("DELETE FROM words WHERE id = ?").run(id);
        }
        dbWrite.exec("COMMIT");
      } finally {
        dbWrite.close();
      }

      try {
        const { status, body } = await request(
          server,
          "GET",
          "/api/quiz/readiness",
        );
        assert.equal(status, 200);
        assert.equal(body.can_start, false);
        assert.equal(body.word_count, 1);
        assert.ok(
          typeof body.message === "string" && body.message.length > 0,
          "message 應為非空字串，告知還需新增幾個詞",
        );
      } finally {
        // 無論測試是否通過，都還原完整 15 個詞
        restoreTestWords();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // T012: POST /api/quiz/sessions + 答題相關
  // ────────────────────────────────────────────────────────────

  describe("T012 quiz session lifecycle", () => {
    it("T012a: POST /api/quiz/sessions 回傳 201，questions.length === 10", async () => {
      const { status, body } = await request(
        server,
        "POST",
        "/api/quiz/sessions",
      );
      assert.equal(status, 201);
      assert.ok(Array.isArray(body.questions), "回應應包含 questions 陣列");
      assert.equal(body.questions.length, 10, "應有 10 道題");
    });

    it("T012b: 每題均有 option_a/b/c/d（4 個非空字串）", async () => {
      const { status, body } = await request(
        server,
        "POST",
        "/api/quiz/sessions",
      );
      assert.equal(status, 201);
      for (const q of body.questions) {
        for (const key of ["option_a", "option_b", "option_c", "option_d"]) {
          assert.ok(
            typeof q[key] === "string" && q[key].length > 0,
            `題目 "${q.french_word}" 缺少或空的 ${key}`,
          );
        }
      }
    });

    it("T012c: 每題 correct_answer 等於其中一個 option 值", async () => {
      const { status, body } = await request(
        server,
        "POST",
        "/api/quiz/sessions",
      );
      assert.equal(status, 201);
      for (const q of body.questions) {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
        assert.ok(
          opts.includes(q.correct_answer),
          `"${q.french_word}" 的 correct_answer "${q.correct_answer}" 不在選項 [${opts.join(", ")}] 中`,
        );
      }
    });

    it("T012d: GET /api/quiz/sessions/999999 回傳 404 { error: <字串> }", async () => {
      const { status, body } = await request(
        server,
        "GET",
        "/api/quiz/sessions/999999",
      );
      assert.equal(status, 404);
      assert.ok(
        typeof body.error === "string" && body.error.length > 0,
        "404 回應應包含非空 error 字串",
      );
    });

    it("T012e: 每題 4 個 option 唯一（new Set(opts).size === 4）", async () => {
      const { status, body } = await request(
        server,
        "POST",
        "/api/quiz/sessions",
      );
      assert.equal(status, 201);
      for (const q of body.questions) {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
        assert.equal(
          new Set(opts).size,
          4,
          `"${q.french_word}" 有重複選項：[${opts.join(", ")}]`,
        );
      }
    });

    it("T012f: POST answers 提交正確答案回傳 { is_correct: true }", async () => {
      // Step 1: 建立 session，取得第一題資訊
      const sessionRes = await request(server, "POST", "/api/quiz/sessions");
      assert.equal(sessionRes.status, 201, "建立 session 應回傳 201");
      const { session_id, questions } = sessionRes.body;
      const q = questions[0];

      // Step 2: 找出 correct_answer 對應的選項字母（a/b/c/d）
      const optMap = {
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
      };
      const correctLetter = Object.keys(optMap).find(
        (k) => optMap[k] === q.correct_answer,
      );
      assert.ok(
        correctLetter,
        `找不到 correct_answer "${q.correct_answer}" 對應的選項字母`,
      );

      // Step 3: 提交正確答案
      const ansRes = await request(
        server,
        "POST",
        `/api/quiz/sessions/${session_id}/answers`,
        { question_id: q.question_id, selected_option: correctLetter },
      );
      assert.equal(ansRes.status, 200, "提交答案應回傳 200");
      assert.equal(
        ansRes.body.is_correct,
        true,
        "提交正確答案應回傳 is_correct: true",
      );
    });

    it("T012g: 9 A1 + 1 B2 詞時 session 可建立，B2 題有 4 個唯一選項（fallback_words 補充）", async () => {
      // 縮減 words table 到 9 個 A1 + 1 個 B2（共 10 個）
      const dbRead = new DatabaseSync(TEST_DB);
      const rows = dbRead.prepare("SELECT id, cefr_level FROM words").all();
      dbRead.close();

      const keepIds = new Set([
        ...rows
          .filter((r) => r.cefr_level === "A1")
          .slice(0, 9)
          .map((r) => r.id),
        ...rows
          .filter((r) => r.cefr_level === "B2")
          .slice(0, 1)
          .map((r) => r.id),
      ]);
      const removeIds = rows.filter((r) => !keepIds.has(r.id)).map((r) => r.id);

      // 同步執行刪除，確保在 HTTP 請求前完成
      const dbWrite = new DatabaseSync(TEST_DB);
      try {
        dbWrite.exec("BEGIN IMMEDIATE");
        for (const id of removeIds) {
          dbWrite.prepare("DELETE FROM words WHERE id = ?").run(id);
        }
        dbWrite.exec("COMMIT");
      } finally {
        dbWrite.close();
      }

      try {
        // 建立 session：恰好 10 個詞，應能成功（B2 題靠 fallback_words 補干擾選項）
        const { status, body } = await request(
          server,
          "POST",
          "/api/quiz/sessions",
        );
        assert.equal(status, 201, "10 個詞時仍應能建立 session（回傳 201）");
        assert.ok(Array.isArray(body.questions), "questions 應為陣列");
        assert.equal(body.questions.length, 10, "應有 10 道題");

        // 恰好 10 個詞，全部都被選到 → B2 詞一定出現
        const b2Q = body.questions.find(
          (q) => q.french_word === "epanouissement",
        );
        assert.ok(
          b2Q,
          "B2 詞 'epanouissement' 應出現在 10 題中（只有 10 個詞，全部入選）",
        );

        // B2 詞在 words table 中只有 1 筆，需從 fallback_words 補充干擾選項
        const opts = [b2Q.option_a, b2Q.option_b, b2Q.option_c, b2Q.option_d];
        assert.equal(
          new Set(opts).size,
          4,
          `B2 題 "epanouissement" 選項應唯一（fallback 補充後）：[${opts.join(", ")}]`,
        );
      } finally {
        // 無論測試是否通過，都還原完整 15 個詞
        restoreTestWords();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 輔助函式：completedSession / perfectSession
  // ────────────────────────────────────────────────────────────

  /**
   * 建立並完成一個完整 Session（答完 10 題）
   * 交錯策略：偶數 index 答對，奇數 index 故意答錯
   * 回傳 { sessionId, correctCount }，供 T020/T021 驗證
   */
  async function completedSession(server) {
    const sessionRes = await request(server, "POST", "/api/quiz/sessions");
    if (sessionRes.status !== 201) throw new Error("建立 session 失敗");
    const { session_id, questions } = sessionRes.body;

    let correctCount = 0;
    for (const q of questions) {
      // 找出正確答案對應的選項字母（a/b/c/d）
      const optMap = {
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
      };
      const correctLetter = Object.keys(optMap).find(
        (k) => optMap[k] === q.correct_answer,
      );
      // 偶數題（index 0,2,4,6,8）正確，奇數題（index 1,3,5,7,9）錯誤
      // 讓 missed-words 有內容可測（共 5 題答錯）
      const idx = questions.indexOf(q);
      let selected;
      if (idx % 2 === 0) {
        selected = correctLetter; // 正確答案
        correctCount++;
      } else {
        // 選一個非正確答案的選項
        const wrongLetter = Object.keys(optMap).find(
          (k) => k !== correctLetter,
        );
        selected = wrongLetter; // 故意答錯
      }
      await request(
        server,
        "POST",
        `/api/quiz/sessions/${session_id}/answers`,
        { question_id: q.question_id, selected_option: selected },
      );
    }
    return { sessionId: session_id, correctCount };
  }

  /**
   * 建立並以全對方式完成一個 Session（滿分 10/10）
   * 供 T021b 驗證 missed_count === 0 的路徑
   */
  async function perfectSession(server) {
    const sessionRes = await request(server, "POST", "/api/quiz/sessions");
    if (sessionRes.status !== 201) throw new Error("建立 session 失敗");
    const { session_id, questions } = sessionRes.body;

    for (const q of questions) {
      const optMap = {
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
      };
      // 每題都提交正確答案
      const correctLetter = Object.keys(optMap).find(
        (k) => optMap[k] === q.correct_answer,
      );
      await request(
        server,
        "POST",
        `/api/quiz/sessions/${session_id}/answers`,
        { question_id: q.question_id, selected_option: correctLetter },
      );
    }
    return session_id;
  }

  // ────────────────────────────────────────────────────────────
  // T020: GET /api/quiz/sessions/:id/results
  // ────────────────────────────────────────────────────────────

  describe("T020 results endpoint", () => {
    it("T020a: 已完成 session 回傳 200 { total_questions:10, correct_count, incorrect_count, percentage }", async () => {
      const { sessionId } = await completedSession(server);
      const { status, body } = await request(
        server,
        "GET",
        `/api/quiz/sessions/${sessionId}/results`,
      );
      assert.equal(status, 200);
      assert.equal(body.total_questions, 10);
      assert.equal(
        typeof body.correct_count,
        "number",
        "correct_count 應為數字",
      );
      assert.equal(
        typeof body.incorrect_count,
        "number",
        "incorrect_count 應為數字",
      );
      assert.equal(
        body.correct_count + body.incorrect_count,
        10,
        "correct_count + incorrect_count 應等於 10",
      );
      assert.equal(typeof body.percentage, "number", "percentage 應為數字");
      assert.ok(
        body.percentage >= 0 && body.percentage <= 100,
        `percentage 應在 0-100 之間，實際：${body.percentage}`,
      );
    });

    it("T020b: 進行中 session 回傳 400 { error: <字串> }", async () => {
      // 建立一個只答第一題的 in-progress session
      const sessionRes = await request(server, "POST", "/api/quiz/sessions");
      assert.equal(sessionRes.status, 201, "建立 session 應回傳 201");
      const { session_id, questions } = sessionRes.body;
      const q = questions[0];
      const optMap = {
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
      };
      // 只提交第一題，session 仍在進行中（共 10 題）
      const anyLetter = Object.keys(optMap)[0];
      await request(
        server,
        "POST",
        `/api/quiz/sessions/${session_id}/answers`,
        { question_id: q.question_id, selected_option: anyLetter },
      );

      const { status, body } = await request(
        server,
        "GET",
        `/api/quiz/sessions/${session_id}/results`,
      );
      assert.equal(status, 400);
      assert.ok(
        typeof body.error === "string" && body.error.length > 0,
        "400 回應應包含非空 error 字串",
      );
    });

    it("T020c: 不存在的 session 回傳 404 { error: <字串> }", async () => {
      const { status, body } = await request(
        server,
        "GET",
        "/api/quiz/sessions/999999/results",
      );
      assert.equal(status, 404);
      assert.ok(
        typeof body.error === "string" && body.error.length > 0,
        "404 回應應包含非空 error 字串",
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // T021: GET /api/quiz/sessions/:id/missed
  // ────────────────────────────────────────────────────────────

  describe("T021 missed endpoint", () => {
    it("T021a: 回傳 missed_words 陣列，每項含 { french, correct_answer, selected_answer }", async () => {
      const { sessionId } = await completedSession(server);
      const { status, body } = await request(
        server,
        "GET",
        `/api/quiz/sessions/${sessionId}/missed`,
      );
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.missed_words), "missed_words 應為陣列");
      // completedSession 奇數 index 題答錯，10 題中有 5 題錯（index 1,3,5,7,9）
      assert.ok(
        body.missed_words.length > 0,
        "應有至少一個答錯的詞（奇數 index 題故意答錯）",
      );
      for (const item of body.missed_words) {
        assert.ok(
          typeof item.french === "string" && item.french.length > 0,
          `french 應為非空字串，實際：${JSON.stringify(item.french)}`,
        );
        assert.ok(
          typeof item.correct_answer === "string" &&
            item.correct_answer.length > 0,
          `correct_answer 應為非空字串，實際：${JSON.stringify(item.correct_answer)}`,
        );
        assert.ok(
          typeof item.selected_answer === "string" &&
            item.selected_answer.length > 0,
          `selected_answer 應為非空字串，實際：${JSON.stringify(item.selected_answer)}`,
        );
      }
    });

    it("T021b: 滿分 session 回傳 { missed_count: 0, missed_words: [] }", async () => {
      const sessionId = await perfectSession(server);
      const { status, body } = await request(
        server,
        "GET",
        `/api/quiz/sessions/${sessionId}/missed`,
      );
      assert.equal(status, 200);
      assert.equal(body.missed_count, 0, "missed_count 應為 0");
      assert.deepEqual(body.missed_words, [], "missed_words 應為空陣列");
    });
  });
});
