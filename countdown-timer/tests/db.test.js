/**
 * db.test.js — db.js 的行為合約測試
 *
 * 每個測試使用獨立的記憶體資料庫，避免測試間相互影響。
 * 使用 node:test + node:assert strict 模式。
 */

import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import {
  createDatabase,
  addActivity,
  getAllActivities,
  deleteActivity,
} from "../db.js";

// ──────────────────────────────────────────────────
// 輔助：建立一個只在單一測試中存活的記憶體 DB
// ──────────────────────────────────────────────────
function makeDb() {
  return createDatabase(":memory:");
}

// 合法的測試用目標日期（未來或過去都可接受，格式合法即可）
const VALID_TARGET = "2099-12-31T23:59";

describe("DB 層測試", () => {
  // ── 測試 1：addActivity 正常案例 ──────────────────
  test("addActivity 新增活動後 getAllActivities 可查回且含必要欄位", () => {
    const db = makeDb();
    after(() => db.close());

    const activity = addActivity(db, "學習 Node.js", VALID_TARGET);

    // 回傳值須含 id
    assert.ok(activity.id, "應有 id 欄位");
    assert.equal(activity.name, "學習 Node.js");
    assert.equal(activity.target_at, VALID_TARGET);
    assert.ok(activity.created_at, "應有 created_at 欄位");

    // getAllActivities 也能查到同一筆
    const list = getAllActivities(db);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "學習 Node.js");
    assert.equal(list[0].target_at, VALID_TARGET);
  });

  // ── 測試 2：空白名稱（完全空字串）拋出錯誤 ─────────
  test("addActivity 空白名稱應拋出 Error", () => {
    const db = makeDb();
    after(() => db.close());

    assert.throws(() => addActivity(db, "", VALID_TARGET), {
      message: "名稱不可為空白",
    });
  });

  // ── 測試 3：純空白字元名稱也拋出錯誤 ───────────────
  test("addActivity 純空白字元名稱也應拋出 Error", () => {
    const db = makeDb();
    after(() => db.close());

    assert.throws(() => addActivity(db, "   ", VALID_TARGET), {
      message: "名稱不可為空白",
    });
  });

  // ── 測試 4：空資料庫回傳空陣列 ─────────────────────
  test("getAllActivities 空資料庫應回傳空陣列", () => {
    const db = makeDb();
    after(() => db.close());

    const list = getAllActivities(db);
    assert.deepEqual(list, []);
  });

  // ── 測試 5：排序 — 多筆依 target_at 升冪 ──────────
  test("getAllActivities 多筆活動依 target_at 升冪排列", () => {
    const db = makeDb();
    after(() => db.close());

    // 故意以「晚→早」順序插入
    addActivity(db, "晚的事件", "2099-06-15T12:00");
    addActivity(db, "早的事件", "2099-01-01T08:00");
    addActivity(db, "中間事件", "2099-03-20T18:30");

    const list = getAllActivities(db);
    assert.equal(list.length, 3);
    assert.equal(list[0].name, "早的事件");
    assert.equal(list[1].name, "中間事件");
    assert.equal(list[2].name, "晚的事件");
  });

  // ── 測試 6：deleteActivity 刪除存在的 ID ───────────
  test("deleteActivity 刪除存在的 ID 回傳 true 且活動不再存在", () => {
    const db = makeDb();
    after(() => db.close());

    const activity = addActivity(db, "待刪除", VALID_TARGET);
    const result = deleteActivity(db, activity.id);

    assert.equal(result, true);
    const list = getAllActivities(db);
    assert.equal(list.length, 0);
  });

  // ── 測試 7：deleteActivity 刪除不存在的 ID 回傳 false ─
  test("deleteActivity 刪除不存在的 ID 應回傳 false 不拋錯", () => {
    const db = makeDb();
    after(() => db.close());

    // 使用一個不存在的 ID（資料庫空的，999 肯定不存在）
    const result = deleteActivity(db, 999);
    assert.equal(result, false);
  });
});
