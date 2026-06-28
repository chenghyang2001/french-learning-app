/**
 * db.js — SQLite 資料存取層
 *
 * 使用 node:sqlite 的 DatabaseSync（同步 API，非 Promise）。
 * 所有查詢使用參數化語法，避免 SQL 注入。
 */

import { DatabaseSync } from "node:sqlite";

/**
 * 建立並初始化資料庫，並插入種子文章。
 *
 * @param {string} dbPath - ':memory:' 或檔案路徑（如 'comments.db'）
 * @returns {DatabaseSync} 已初始化的 SQLite 連線實例
 */
export function createDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);

  // 啟用外鍵約束（CASCADE DELETE 的必要條件，必須在建表前執行）
  db.exec("PRAGMA foreign_keys = ON");

  // 建立 articles 資料表
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    )
  `);

  // 建立 comments 資料表（parent_id 支援巢狀留言，ON DELETE CASCADE 讓刪子留言時連帶刪孫）
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      parent_id  INTEGER,
      content    TEXT    NOT NULL CHECK(length(trim(content)) > 0 AND length(content) <= 500),
      created_at TEXT    NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id),
      FOREIGN KEY (parent_id)  REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // 插入種子文章（固定 id，INSERT OR IGNORE 避免重複插入）
  db.exec(`
    INSERT OR IGNORE INTO articles (id, title, content, created_at) VALUES
      (1, 'Les salutations', '法語問候語教學：Bonjour, Bonsoir, Salut...', '2026-01-01 00:00'),
      (2, 'Les nombres 1-20', '法語數字 1 到 20 教學：un, deux, trois...', '2026-01-01 00:00'),
      (3, 'Les couleurs', '法語顏色教學：rouge, bleu, vert...', '2026-01-01 00:00')
  `);

  return db;
}

/**
 * 取得所有文章，依 id 升冪排列。
 * TODO Task 3 實作
 *
 * @param {DatabaseSync} db
 */
export function getAllArticles(db) {
  const rows = db.prepare("SELECT * FROM articles ORDER BY id ASC").all();
  return rows ?? [];
}

/**
 * 依 id 取得單一文章。
 * TODO Task 3 實作
 *
 * @param {DatabaseSync} db
 * @param {number} articleId
 */
export function getArticleById(db, articleId) {
  return db.prepare("SELECT * FROM articles WHERE id = ?").get(articleId);
}

/**
 * 取得指定文章的所有留言（含巢狀）。
 * TODO Task 3 實作
 *
 * @param {DatabaseSync} db
 * @param {number} articleId
 */
export function getCommentsByArticle(db, articleId) {
  const rows = db
    .prepare(
      "SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC",
    )
    .all(articleId);
  return rows ?? [];
}

/**
 * 新增留言到指定文章。
 * TODO Task 4 實作
 *
 * @param {DatabaseSync} db
 * @param {number} articleId
 * @param {string} content
 * @param {number|null} parentId
 */
export function addComment(db, articleId, content, parentId) {
  // Step 1：content 驗證（依 parentId 是否為 null 給不同錯誤訊息）
  const isReply = parentId !== null && parentId !== undefined;

  if (!content || content.trim().length === 0) {
    throw new Error(isReply ? "回覆內容不可為空白" : "評論內容不可為空白");
  }

  if (content.length > 500) {
    throw new Error(
      isReply ? "回覆不可超過 500 字元" : "評論不可超過 500 字元",
    );
  }

  // Step 2：articleId 存在性驗證
  const article = db
    .prepare("SELECT id FROM articles WHERE id = ?")
    .get(articleId);
  if (!article) {
    throw new Error("文章不存在");
  }

  // Step 3：parentId 驗證（只在 isReply 時執行）
  if (isReply) {
    const parent = db
      .prepare("SELECT id, parent_id FROM comments WHERE id = ?")
      .get(parentId);
    if (!parent) {
      throw new Error("原評論不存在");
    }
    // 防止三層巢狀：parent 本身的 parent_id 不能是非 null
    if (parent.parent_id !== null) {
      throw new Error("不支援對回覆再次回覆");
    }
  }

  // Step 4：插入評論
  // sv-SE locale 產生 "YYYY-MM-DD HH:MM:SS" 格式，slice 取前 16 字元得 "YYYY-MM-DD HH:MM"
  const created_at = new Date().toLocaleString("sv-SE").slice(0, 16);
  const stmt = db.prepare(
    "INSERT INTO comments (article_id, parent_id, content, created_at) VALUES (?, ?, ?, ?)",
  );
  const result = stmt.run(articleId, parentId ?? null, content, created_at);

  // 查回剛插入的完整 row
  return db
    .prepare("SELECT * FROM comments WHERE id = ?")
    .get(result.lastInsertRowid);
}

/**
 * 刪除指定留言（子留言由 CASCADE DELETE 自動刪除）。
 * TODO Task 5 實作
 *
 * @param {DatabaseSync} db
 * @param {number} commentId
 */
export function deleteComment(db, commentId) {
  const result = db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
  // CASCADE DELETE 由 SQLite 自動處理（因 PRAGMA foreign_keys = ON + ON DELETE CASCADE）
  return result.changes > 0;
}
