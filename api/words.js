"use strict";
/**
 * api/words.js
 * 詞彙管理 API Router
 *
 * GET /
 *   - ?cefr=A1|A2|B1|B2  過濾 CEFR 等級
 *   - ?due=true           只回傳今日到期詞彙（next_review_at <= date('now')）
 *   回傳 { count, words: [...] }
 */

const express = require("express");
const router = express.Router();
const getDb = require("./db");

// GET /
// 查詢 words 表，支援可選 cefr 等級過濾與 due 到期篩選
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const { cefr, due } = req.query;

    const conditions = [];
    const params = [];

    // cefr 等級篩選：驗證值必須是 A1/A2/B1/B2，防止非法輸入
    if (cefr !== undefined) {
      const valid = ["A1", "A2", "B1", "B2"];
      if (!valid.includes(cefr)) {
        return res.status(400).json({
          error: `cefr 參數必須是 A1/A2/B1/B2，收到：${cefr}`,
        });
      }
      conditions.push("cefr_level = ?");
      params.push(cefr);
    }

    // due=true：只回傳今天到期需複習的詞彙
    if (due === "true") {
      conditions.push("next_review_at <= date('now')");
    }

    const where =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // 使用參數化查詢防止 SQL injection，依到期時間升序排列
    const sql = `SELECT * FROM words ${where} ORDER BY next_review_at ASC, id ASC`;
    const words = db.prepare(sql).all(...params);

    return res.status(200).json({ count: words.length, words });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
