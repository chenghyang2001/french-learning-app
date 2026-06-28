/**
 * db.test.js — user-comments db.js 的行為合約測試
 *
 * 每個測試使用獨立的記憶體資料庫，避免測試間相互影響。
 * 使用 node:test + node:assert/strict。
 */

import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import {
  createDatabase,
  addComment,
  getCommentsByArticle,
  deleteComment,
} from "../db.js";

// ──────────────────────────────────────────────────
// 輔助：建立一個只在單一測試中存活的記憶體 DB
// ──────────────────────────────────────────────────
function makeDb() {
  return createDatabase(":memory:");
}

describe("DB 層測試", () => {
  // ── 測試 1：createDatabase 種子資料 ──────────────
  test("createDatabase 建立兩張資料表且種子文章存在", () => {
    const db = makeDb();
    after(() => db.close());

    const articles = db.prepare("SELECT * FROM articles ORDER BY id").all();
    assert.equal(articles.length, 3);
    assert.equal(articles[0].title, "Les salutations");
    assert.equal(articles[1].title, "Les nombres 1-20");
    assert.equal(articles[2].title, "Les couleurs");
  });

  // ── 測試 2：addComment 頂層評論 happy path ─────────
  test("addComment 新增頂層評論成功", () => {
    const db = makeDb();
    after(() => db.close());

    const comment = addComment(db, 1, "這篇文章很有幫助！", null);
    assert.ok(comment.id);
    assert.equal(comment.article_id, 1);
    assert.equal(comment.parent_id, null);
    assert.equal(comment.content, "這篇文章很有幫助！");
    assert.ok(comment.created_at, "應有 created_at");
  });

  // ── 測試 3：addComment 回覆 happy path ────────────
  test("addComment 新增回覆成功", () => {
    const db = makeDb();
    after(() => db.close());

    const parent = addComment(db, 1, "頂層評論", null);
    const reply = addComment(db, 1, "這是回覆", parent.id);
    assert.equal(reply.parent_id, parent.id);
    assert.equal(reply.content, "這是回覆");
  });

  // ── 測試 4：addComment 空白頂層評論 ──────────────
  test("addComment 空白頂層評論拋出「評論內容不可為空白」", () => {
    const db = makeDb();
    after(() => db.close());

    assert.throws(() => addComment(db, 1, "   ", null), {
      message: "評論內容不可為空白",
    });
  });

  // ── 測試 5：addComment 空白回覆 ───────────────────
  test("addComment 空白回覆拋出「回覆內容不可為空白」", () => {
    const db = makeDb();
    after(() => db.close());

    const parent = addComment(db, 1, "頂層", null);
    assert.throws(() => addComment(db, 1, "  ", parent.id), {
      message: "回覆內容不可為空白",
    });
  });

  // ── 測試 6：addComment 超過 500 字元（頂層） ──────
  test("addComment 頂層評論超 500 字拋出「評論不可超過 500 字元」", () => {
    const db = makeDb();
    after(() => db.close());

    const long = "a".repeat(501);
    assert.throws(() => addComment(db, 1, long, null), {
      message: "評論不可超過 500 字元",
    });
  });

  // ── 測試 7：addComment 文章不存在 ─────────────────
  test("addComment article_id 不存在拋出「文章不存在」", () => {
    const db = makeDb();
    after(() => db.close());

    assert.throws(() => addComment(db, 999, "內容", null), {
      message: "文章不存在",
    });
  });

  // ── 測試 8：addComment parent_id 不存在 ───────────
  test("addComment parent_id 不存在拋出「原評論不存在」", () => {
    const db = makeDb();
    after(() => db.close());

    assert.throws(() => addComment(db, 1, "回覆", 999), {
      message: "原評論不存在",
    });
  });

  // ── 測試 9：addComment 防止三層巢狀 ──────────────
  test("addComment 對回覆層再次回覆拋出「不支援對回覆再次回覆」", () => {
    const db = makeDb();
    after(() => db.close());

    const top = addComment(db, 1, "頂層", null);
    const reply = addComment(db, 1, "第二層", top.id);
    assert.throws(() => addComment(db, 1, "第三層", reply.id), {
      message: "不支援對回覆再次回覆",
    });
  });

  // ── 測試 10：getCommentsByArticle 無評論 ──────────
  test("getCommentsByArticle 無評論時回傳空陣列", () => {
    const db = makeDb();
    after(() => db.close());

    const list = getCommentsByArticle(db, 1);
    assert.deepEqual(list, []);
  });

  // ── 測試 11：getCommentsByArticle 有評論依時間升冪 ─
  test("getCommentsByArticle 回傳平坦陣列依 created_at ASC", () => {
    const db = makeDb();
    after(() => db.close());

    addComment(db, 1, "第一則", null);
    addComment(db, 1, "第二則", null);
    const list = getCommentsByArticle(db, 1);
    assert.equal(list.length, 2);
    assert.equal(list[0].content, "第一則");
    assert.equal(list[1].content, "第二則");
  });

  // ── 測試 12：deleteComment 頂層且 CASCADE 刪除子回覆 ─
  test("deleteComment 刪除頂層評論且子回覆自動 CASCADE 刪除", () => {
    const db = makeDb();
    after(() => db.close());

    const top = addComment(db, 1, "頂層", null);
    addComment(db, 1, "回覆", top.id);

    const result = deleteComment(db, top.id);
    assert.equal(result, true);

    // 子回覆也不見了
    const list = getCommentsByArticle(db, 1);
    assert.equal(list.length, 0);
  });

  // ── 測試 13：deleteComment 刪除不存在的 id ────────
  test("deleteComment 刪除不存在的 id 回傳 false", () => {
    const db = makeDb();
    after(() => db.close());

    const result = deleteComment(db, 9999);
    assert.equal(result, false);
  });
});
