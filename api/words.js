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

// PATCH /:id/review — 記錄複習結果，依 SM-2 更新 srs_interval 與 next_review_at
router.patch("/:id/review", (req, res) => {
  const id = Number(req.params.id);
  const { known } = req.body;

  // 驗證 id 必須是正整數，防止非法路由參數污染 SQL
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "無效的 id" });
  }
  // known 必須是 boolean，字串 "true" 不被接受（避免型別誤判）
  if (typeof known !== "boolean") {
    return res.status(400).json({ error: "known 必須是 boolean" });
  }

  try {
    const db = getDb();
    const word = db
      .prepare("SELECT srs_interval FROM words WHERE id = ?")
      .get(id);
    if (!word) {
      return res.status(404).json({ error: "找不到單字" });
    }

    // SM-2 簡化版：答對則間隔 ×2（上限 30 天），答錯則重置為 1 天
    const newInterval = known ? Math.min(word.srs_interval * 2, 30) : 1;
    db.prepare(
      "UPDATE words SET srs_interval = ?, next_review_at = date('now', '+' || ? || ' days') WHERE id = ?",
    ).run(newInterval, newInterval, id);

    const updated = db
      .prepare(
        "SELECT id, srs_interval, next_review_at FROM words WHERE id = ?",
      )
      .get(id);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
