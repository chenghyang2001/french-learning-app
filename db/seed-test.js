"use strict";
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// 資料庫路徑由 __dirname 相對計算，避免硬編碼使用者目錄
const DB_PATH = path.join(__dirname, "..", "data", "french-quiz.db");

try {
  const db = new DatabaseSync(DB_PATH);

  // 清空舊資料，確保每次執行結果一致（safe re-run）
  db.exec("DELETE FROM words");

  const insert = db.prepare(
    "INSERT INTO words(french, english, cefr_level) VALUES(?, ?, ?)",
  );

  const words = [
    // A1 — 13 個單詞（需求：≥12 個 A1）
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
    // A2 — 1 個單詞
    ["acheter", "to buy", "A2"],
    // B2 — 恰好 1 個，確保 fallback_words 邏輯在 T012(g) 被觸發
    // （B2 詞不足 3 個，系統必須從其他 CEFR level 補充）
    ["epanouissement", "fulfillment", "B2"],
  ];

  // 用 BEGIN IMMEDIATE/COMMIT 確保 15 筆全部成功或全部回滾
  // node:sqlite 無 db.transaction() API，改用手動事務控制
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [french, english, cefr] of words) {
      insert.run(french, english, cefr);
    }
    db.exec("COMMIT");
  } catch (txErr) {
    db.exec("ROLLBACK");
    throw txErr;
  }
  db.close();

  console.log(`Seeded ${words.length} test words (A1:13, A2:1, B2:1)`);
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exit(1);
}
