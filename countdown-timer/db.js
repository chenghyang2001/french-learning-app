/**
 * db.js — SQLite 資料存取層
 *
 * 使用 node:sqlite 的 DatabaseSync（同步 API，非 Promise）。
 * 所有查詢使用參數化語法，避免 SQL 注入。
 */

import { DatabaseSync } from "node:sqlite";

// 目標日期格式正規表達式：YYYY-MM-DDTHH:MM
const TARGET_AT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * 建立並初始化資料庫。
 *
 * @param {string} dbPath - ':memory:' 或檔案路徑（如 'countdown.db'）
 * @returns {DatabaseSync} 已初始化的 SQLite 連線實例
 */
export function createDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);

  // 建立 activities 資料表（若不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL CHECK(length(trim(name)) > 0),
      target_at  TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    )
  `);

  return db;
}

/**
 * 新增一筆活動到資料庫。
 *
 * @param {DatabaseSync} db
 * @param {string} name - 活動名稱（trim 後不可為空）
 * @param {string} target_at - 目標日期，格式 YYYY-MM-DDTHH:MM
 * @returns {{ id: number, name: string, target_at: string, created_at: string }}
 * @throws {Error} 名稱或日期格式驗證失敗時拋出
 */
export function addActivity(db, name, target_at) {
  // 驗證名稱：trim 後不可為空
  if (!name || name.trim().length === 0) {
    throw new Error("名稱不可為空白");
  }

  // 驗證目標日期格式
  if (!target_at || !TARGET_AT_REGEX.test(target_at)) {
    throw new Error("目標日期格式錯誤，請使用 YYYY-MM-DDTHH:MM");
  }

  // created_at 取當下時間，截到分鐘精度
  const created_at = new Date().toISOString().slice(0, 16);

  const stmt = db.prepare(
    "INSERT INTO activities (name, target_at, created_at) VALUES (?, ?, ?)",
  );
  const result = stmt.run(name.trim(), target_at, created_at);

  // 查回剛插入的完整 row
  const row = db
    .prepare("SELECT * FROM activities WHERE id = ?")
    .get(result.lastInsertRowid);

  return row;
}

/**
 * 取得所有活動，依 target_at 升冪排列。
 *
 * @param {DatabaseSync} db
 * @returns {Array<{ id: number, name: string, target_at: string, created_at: string }>}
 */
export function getAllActivities(db) {
  const rows = db
    .prepare("SELECT * FROM activities ORDER BY target_at ASC")
    .all();

  // node:sqlite 在空結果時回傳 undefined，需轉為空陣列
  return rows ?? [];
}

/**
 * 刪除指定 id 的活動。
 *
 * @param {DatabaseSync} db
 * @param {number} id
 * @returns {boolean} true 表示有刪除，false 表示 id 不存在
 */
export function deleteActivity(db, id) {
  const result = db.prepare("DELETE FROM activities WHERE id = ?").run(id);

  // changes 為實際影響的資料列數
  return result.changes > 0;
}
