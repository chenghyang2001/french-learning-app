/**
 * api.test.js — HTTP API 整合測試
 *
 * 16 個整合測試覆蓋 4 個 API 端點的完整行為。
 * 每個測試使用獨立的 :memory: DB + HTTP server，避免測試間干擾。
 * 使用 node:test + node:assert/strict + Node.js 22 內建 fetch。
 */

import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createDatabase } from "../db.js";
import { createRequestHandler } from "../server.js";

// ──────────────────────────────────────────────────────
// 測試輔助：建立隔離的測試 server
// ──────────────────────────────────────────────────────

/**
 * 建立一個 :memory: DB + HTTP server，監聽 OS 自動分配的隨機 port。
 * 回傳 { db, server, req, cleanup }。
 *
 * @returns {Promise<{ db: object, server: object, req: Function, cleanup: Function }>}
 */
function startTestServer() {
  const db = createDatabase(":memory:");
  const server = createServer(createRequestHandler(db));

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;

      /**
       * 發送 HTTP 請求，回傳 { status, data }。
       *
       * @param {'GET'|'POST'|'DELETE'} method
       * @param {string} path
       * @param {object|undefined} body
       * @returns {Promise<{ status: number, data: unknown }>}
       */
      async function req(method, path, body) {
        const opts = {
          method,
          headers: { "Content-Type": "application/json" },
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(`${baseUrl}${path}`, opts);
        const data = await res.json();
        return { status: res.status, data };
      }

      /** 關閉 server 並釋放 db（回傳 Promise 讓 node:test after 可等待）*/
      function cleanup() {
        return new Promise((res) => {
          server.close(() => {
            db.close();
            res();
          });
        });
      }

      resolve({ db, server, req, cleanup });
    });
    server.on("error", reject);
  });
}

// ──────────────────────────────────────────────────────
// 測試套件
// ──────────────────────────────────────────────────────

describe("API 整合測試", { concurrency: false }, () => {
  // ══════════════════════════════════════════════════
  // GET /api/articles
  // ══════════════════════════════════════════════════

  // ── 測試 1：回傳 3 篇種子文章 ───────────────────────
  test("GET /api/articles 應回傳 status 200 且 3 篇種子文章", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("GET", "/api/articles");
    assert.equal(status, 200);
    assert.equal(data.length, 3, "應有 3 篇種子文章");
  });

  // ══════════════════════════════════════════════════
  // GET /api/articles/:id/comments
  // ══════════════════════════════════════════════════

  // ── 測試 2：無評論回傳空陣列 ────────────────────────
  test("GET /api/articles/1/comments 無評論應回傳空陣列 []", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("GET", "/api/articles/1/comments");
    assert.equal(status, 200);
    assert.deepEqual(data, []);
  });

  // ── 測試 3：頂層評論 + 回覆應回傳巢狀結構 ─────────────
  test("GET /api/articles/1/comments 頂層+回覆應回傳含 replies 陣列的巢狀結構", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    // 先新增頂層評論
    const { data: top } = await req("POST", "/api/articles/1/comments", {
      content: "頂層評論",
    });
    // 再新增回覆
    await req("POST", "/api/articles/1/comments", {
      content: "這是回覆",
      parent_id: top.id,
    });

    const { status, data } = await req("GET", "/api/articles/1/comments");
    assert.equal(status, 200);
    assert.equal(data.length, 1, "頂層評論只有 1 筆");
    assert.equal(data[0].content, "頂層評論");
    assert.ok(Array.isArray(data[0].replies), "頂層評論應有 replies 陣列");
    assert.equal(data[0].replies.length, 1, "回覆應有 1 筆");
    assert.equal(data[0].replies[0].content, "這是回覆");
  });

  // ── 測試 4：文章 ID 非整數 → 400 ───────────────────
  test("GET /api/articles/abc/comments 非整數 ID 應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("GET", "/api/articles/abc/comments");
    assert.equal(status, 400);
    assert.equal(data.error, "無效的文章 ID");
  });

  // ── 測試 5：文章不存在 → 404 ────────────────────────
  test("GET /api/articles/999/comments 文章不存在應回傳 404", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("GET", "/api/articles/999/comments");
    assert.equal(status, 404);
    assert.equal(data.error, "文章不存在");
  });

  // ══════════════════════════════════════════════════
  // POST /api/articles/:id/comments（頂層評論）
  // ══════════════════════════════════════════════════

  // ── 測試 6：新增頂層評論 → 201 含完整欄位 ─────────────
  test("POST /api/articles/1/comments 新增頂層評論應回傳 201 含 id/article_id/parent_id/content/created_at", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "這篇文章很有幫助！",
    });
    assert.equal(status, 201);
    assert.ok(data.id, "應有 id");
    assert.equal(data.article_id, 1);
    assert.equal(data.parent_id, null);
    assert.equal(data.content, "這篇文章很有幫助！");
    assert.ok(data.created_at, "應有 created_at");
  });

  // ── 測試 7：空白頂層評論 → 400 ─────────────────────
  test("POST /api/articles/1/comments 空白頂層評論應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "   ",
    });
    assert.equal(status, 400);
    assert.equal(data.error, "評論內容不可為空白");
  });

  // ── 測試 8：超過 500 字元 → 400 ────────────────────
  test("POST /api/articles/1/comments 超過 500 字元應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "a".repeat(501),
    });
    assert.equal(status, 400);
    assert.equal(data.error, "評論不可超過 500 字元");
  });

  // ══════════════════════════════════════════════════
  // POST /api/articles/:id/comments（回覆）
  // ══════════════════════════════════════════════════

  // ── 測試 9：新增回覆 → 201 含 parent_id ─────────────
  test("POST /api/articles/1/comments 新增回覆應回傳 201 含 parent_id", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { data: top } = await req("POST", "/api/articles/1/comments", {
      content: "頂層評論",
    });
    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "這是回覆",
      parent_id: top.id,
    });
    assert.equal(status, 201);
    assert.equal(data.parent_id, top.id);
    assert.equal(data.content, "這是回覆");
  });

  // ── 測試 10：空白回覆 → 400 ─────────────────────────
  test("POST /api/articles/1/comments 空白回覆應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { data: top } = await req("POST", "/api/articles/1/comments", {
      content: "頂層評論",
    });
    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "  ",
      parent_id: top.id,
    });
    assert.equal(status, 400);
    assert.equal(data.error, "回覆內容不可為空白");
  });

  // ── 測試 11：文章不存在 → 404 ───────────────────────
  test("POST /api/articles/999/comments 文章不存在應回傳 404", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("POST", "/api/articles/999/comments", {
      content: "測試留言",
    });
    assert.equal(status, 404);
    assert.equal(data.error, "文章不存在");
  });

  // ── 測試 12：parent_id 不存在 → 404 ─────────────────
  test("POST /api/articles/1/comments parent_id 不存在應回傳 404", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "測試回覆",
      parent_id: 99999,
    });
    assert.equal(status, 404);
    assert.equal(data.error, "原評論不存在");
  });

  // ── 測試 13：三層巢狀（對回覆再回覆）→ 400 ────────────
  test("POST /api/articles/1/comments 對回覆再回覆（三層巢狀）應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { data: top } = await req("POST", "/api/articles/1/comments", {
      content: "頂層",
    });
    const { data: reply } = await req("POST", "/api/articles/1/comments", {
      content: "第二層",
      parent_id: top.id,
    });
    const { status, data } = await req("POST", "/api/articles/1/comments", {
      content: "第三層（不允許）",
      parent_id: reply.id,
    });
    assert.equal(status, 400);
    assert.equal(data.error, "不支援對回覆再次回覆");
  });

  // ══════════════════════════════════════════════════
  // DELETE /api/comments/:id
  // ══════════════════════════════════════════════════

  // ── 測試 14：刪除頂層且 CASCADE 刪子回覆 ───────────────
  test("DELETE /api/comments/:id 刪除頂層評論且 CASCADE 子回覆也消失", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    // 新增頂層評論與子回覆
    const { data: top } = await req("POST", "/api/articles/1/comments", {
      content: "頂層評論",
    });
    await req("POST", "/api/articles/1/comments", {
      content: "子回覆",
      parent_id: top.id,
    });

    // 刪除頂層評論
    const { status, data } = await req("DELETE", `/api/comments/${top.id}`);
    assert.equal(status, 200);
    assert.equal(data.deleted, true);
    assert.equal(data.id, top.id);

    // 確認頂層與子回覆都消失（CASCADE 生效）
    const { data: comments } = await req("GET", "/api/articles/1/comments");
    assert.deepEqual(comments, [], "頂層及子回覆應全數刪除");
  });

  // ── 測試 15：刪除不存在的評論 → 404 ────────────────────
  test("DELETE /api/comments/99999 不存在的評論應回傳 404", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("DELETE", "/api/comments/99999");
    assert.equal(status, 404);
    assert.equal(data.error, "評論不存在");
  });

  // ── 測試 16：評論 ID 非整數 → 400 ──────────────────────
  test("DELETE /api/comments/abc 非整數 ID 應回傳 400", async () => {
    const { req, cleanup } = await startTestServer();
    after(cleanup);

    const { status, data } = await req("DELETE", "/api/comments/abc");
    assert.equal(status, 400);
    assert.equal(data.error, "無效的評論 ID");
  });
});
