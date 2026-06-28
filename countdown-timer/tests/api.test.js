/**
 * api.test.js — HTTP API 整合測試
 *
 * 自行建立測試用 HTTP server（使用 :memory: DB），
 * 不直接啟動 server.js 避免 port 衝突。
 * 使用 node:test + node:assert + node:http。
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { createDatabase, addActivity } from "../db.js";
import { createRequestHandler } from "../server.js";

// ──────────────────────────────────────────────────────
// 測試 server 的生命週期管理
// ──────────────────────────────────────────────────────

let server;
let db;
let baseUrl;

before(() => {
  // 每個 describe 共用同一個記憶體 DB 和 server
  // （各測試之間共享狀態，但測試有序排列所以可預測）
  db = createDatabase(":memory:");
  server = createServer(createRequestHandler(db));

  return new Promise((resolve, reject) => {
    // port 0 讓 OS 自動分配可用 port
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
    server.on("error", reject);
  });
});

after(() => {
  db.close();
  return new Promise((resolve) => server.close(resolve));
});

// ──────────────────────────────────────────────────────
// 輔助：發送 HTTP 請求
// ──────────────────────────────────────────────────────

/**
 * 發送 HTTP 請求，回傳 { status, data }。
 *
 * @param {'GET'|'POST'|'DELETE'} method
 * @param {string} path
 * @param {object|undefined} body
 * @returns {Promise<{ status: number, data: any }>}
 */
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = httpRequest(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// ──────────────────────────────────────────────────────
// 測試套件
// ──────────────────────────────────────────────────────

describe("API 整合測試", { concurrency: false }, () => {
  // ── 測試 1：GET /api/activities 空資料庫 ────────────
  test("GET /api/activities 空資料庫應回傳 200 與空陣列", async () => {
    const { status, data } = await request("GET", "/api/activities");
    assert.equal(status, 200);
    assert.deepEqual(data, []);
  });

  // ── 測試 2：POST 正常新增 ─────────────────────────
  test("POST /api/activities 正常新增應回傳 201 含 id、status、countdown", async () => {
    const { status, data } = await request("POST", "/api/activities", {
      name: "學習 Node.js",
      target_at: "2099-12-31T23:59",
    });

    assert.equal(status, 201);
    assert.ok(data.id, "應有 id 欄位");
    assert.equal(data.name, "學習 Node.js");
    assert.ok(data.status, "應有 status 欄位");
    assert.ok(data.countdown, "應有 countdown 欄位");
    assert.ok("days" in data.countdown, "countdown 應有 days");
    assert.ok("hours" in data.countdown, "countdown 應有 hours");
    assert.ok("minutes" in data.countdown, "countdown 應有 minutes");
  });

  // ── 測試 3：POST 缺少 name → 400 ──────────────────
  test("POST /api/activities 缺少 name 應回傳 400", async () => {
    const { status, data } = await request("POST", "/api/activities", {
      target_at: "2099-06-15T12:00",
    });
    assert.equal(status, 400);
    assert.equal(data.error, "名稱不可為空白");
  });

  // ── 測試 4：POST 空白 name → 400 ──────────────────
  test("POST /api/activities 空白 name 應回傳 400", async () => {
    const { status, data } = await request("POST", "/api/activities", {
      name: "   ",
      target_at: "2099-06-15T12:00",
    });
    assert.equal(status, 400);
    assert.equal(data.error, "名稱不可為空白");
  });

  // ── 測試 5：POST 格式錯誤的 target_at → 400 ────────
  test("POST /api/activities 格式錯誤的 target_at 應回傳 400", async () => {
    const { status, data } = await request("POST", "/api/activities", {
      name: "測試活動",
      target_at: "2099/12/31 23:59",
    });
    assert.equal(status, 400);
    assert.ok(data.error, "應有 error 訊息");
  });

  // ── 測試 6：DELETE 存在的 ID → 200 ─────────────────
  test("DELETE /api/activities/:id 刪除存在的活動應回傳 200", async () => {
    // 先新增一筆
    const created = await request("POST", "/api/activities", {
      name: "待刪除的活動",
      target_at: "2099-03-01T09:00",
    });
    const id = created.data.id;

    const { status, data } = await request("DELETE", `/api/activities/${id}`);
    assert.equal(status, 200);
    assert.equal(data.deleted, true);
    assert.equal(data.id, id);
  });

  // ── 測試 7：DELETE 不存在的 ID → 404 ───────────────
  test("DELETE /api/activities/:id 刪除不存在的 ID 應回傳 404", async () => {
    const { status, data } = await request("DELETE", "/api/activities/99999");
    assert.equal(status, 404);
    assert.equal(data.error, "活動不存在");
  });

  // ── 測試 8：DELETE 非整數 ID → 400 ─────────────────
  test("DELETE /api/activities/abc 非整數 ID 應回傳 400", async () => {
    const { status, data } = await request("DELETE", "/api/activities/abc");
    assert.equal(status, 400);
    assert.equal(data.error, "無效的活動 ID");
  });

  // ── 測試 9：GET / → 200 HTML ─────────────────────
  test("GET / 應回傳 200 並提供 HTML 內容", async () => {
    const { status } = await request("GET", "/");
    assert.equal(status, 200);
  });

  // ── 測試 10：排序正確（近的在前）────────────────────
  test("GET /api/activities 新增後排序正確（target_at 升冪）", async () => {
    // 清空目前 DB，重建
    db.exec("DELETE FROM activities");

    // 晚的先插
    await request("POST", "/api/activities", {
      name: "晚的活動",
      target_at: "2099-12-01T00:00",
    });
    await request("POST", "/api/activities", {
      name: "早的活動",
      target_at: "2099-06-01T00:00",
    });

    const { status, data } = await request("GET", "/api/activities");
    assert.equal(status, 200);
    assert.equal(data.length, 2);
    // 早的應排第一
    assert.equal(data[0].name, "早的活動");
    assert.equal(data[1].name, "晚的活動");
  });
});
