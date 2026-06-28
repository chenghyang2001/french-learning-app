/**
 * server.js — HTTP 伺服器入口
 *
 * 使用 node:http 提供 REST API 與靜態資源服務。
 * 匯出 computeCountdown 與 createRequestHandler 供測試使用。
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  addActivity,
  getAllActivities,
  deleteActivity,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// ──────────────────────────────────────────────────────
// 倒數計算純函式（供 api.test.js 測試匯入）
// ──────────────────────────────────────────────────────

/**
 * 根據目標日期計算剩餘時間與狀態。
 *
 * @param {string} targetAt - 格式 YYYY-MM-DDTHH:MM
 * @returns {{ status: string, countdown: { days: number, hours: number, minutes: number } }}
 */
export function computeCountdown(targetAt) {
  const now = new Date();
  const target = new Date(targetAt);

  // 防禦非法日期字串：若 target 為 Invalid Date，diffMs 會是 NaN 並洩漏到回應欄位
  if (isNaN(target.getTime())) {
    return { status: "expired", countdown: { days: 0, hours: 0, minutes: 0 } };
  }

  const diffMs = target - now;

  if (diffMs <= 0) {
    return { status: "expired", countdown: { days: 0, hours: 0, minutes: 0 } };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return { status: "active", countdown: { days, hours, minutes } };
}

// ──────────────────────────────────────────────────────
// 輔助：讀取 request body
// ──────────────────────────────────────────────────────

/**
 * 讀取 HTTP request body，回傳 Promise<string>。
 * 超過 1 MB 時拒絕（防止過大請求）。
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_048_576) {
        reject(new Error("請求內容過大"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ──────────────────────────────────────────────────────
// 輔助：JSON 回應
// ──────────────────────────────────────────────────────

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

// ──────────────────────────────────────────────────────
// 靜態資源 MIME 對照
// ──────────────────────────────────────────────────────

const STATIC_FILES = {
  "/": { file: "index.html", mime: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", mime: "text/css; charset=utf-8" },
  "/app.js": {
    file: "app.js",
    mime: "application/javascript; charset=utf-8",
  },
};

// ──────────────────────────────────────────────────────
// 請求處理器工廠（供測試注入不同 DB 實例）
// ──────────────────────────────────────────────────────

/**
 * 建立 HTTP requestListener，綁定指定的 db 實例。
 * 讓測試可以傳入 :memory: DB 而不影響正式資料庫。
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {import('node:http').RequestListener}
 */
export function createRequestHandler(db) {
  return async function requestHandler(req, res) {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    const method = req.method;

    try {
      // ── GET /api/activities ──────────────────────────
      if (method === "GET" && pathname === "/api/activities") {
        const rows = getAllActivities(db);
        const activities = rows.map((row) => ({
          ...row,
          ...computeCountdown(row.target_at),
        }));
        return sendJson(res, 200, activities);
      }

      // ── POST /api/activities ─────────────────────────
      if (method === "POST" && pathname === "/api/activities") {
        let parsed;
        try {
          const raw = await readBody(req);
          parsed = JSON.parse(raw);
        } catch {
          return sendJson(res, 400, { error: "請求格式錯誤，需為有效的 JSON" });
        }

        const { name, target_at } = parsed ?? {};

        try {
          const activity = addActivity(db, name, target_at);
          const full = { ...activity, ...computeCountdown(activity.target_at) };
          return sendJson(res, 201, full);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }
      }

      // ── DELETE /api/activities/:id ───────────────────
      const deleteMatch = pathname.match(/^\/api\/activities\/([^/]+)$/);
      if (method === "DELETE" && deleteMatch) {
        const rawId = deleteMatch[1];
        const id = Number(rawId);

        // id 必須是正整數
        if (!Number.isInteger(id) || id <= 0) {
          return sendJson(res, 400, { error: "無效的活動 ID" });
        }

        const deleted = deleteActivity(db, id);
        if (!deleted) {
          return sendJson(res, 404, { error: "活動不存在" });
        }
        return sendJson(res, 200, { deleted: true, id });
      }

      // ── 靜態資源 ────────────────────────────────────
      if (method === "GET" && STATIC_FILES[pathname]) {
        const { file, mime } = STATIC_FILES[pathname];
        try {
          const content = readFileSync(join(__dirname, file));
          res.writeHead(200, {
            "Content-Type": mime,
            "Content-Length": content.length,
          });
          return res.end(content);
        } catch {
          return sendJson(res, 500, { error: "伺服器錯誤，請稍後再試" });
        }
      }

      // ── 404 ─────────────────────────────────────────
      sendJson(res, 404, { error: "找不到該路徑" });
    } catch (err) {
      // 確保任何未捕獲的錯誤都不洩漏內部細節
      console.error("[server error]", err);
      sendJson(res, 500, { error: "伺服器錯誤，請稍後再試" });
    }
  };
}

// ──────────────────────────────────────────────────────
// 主程式啟動（直接執行此檔案時）
// ──────────────────────────────────────────────────────

// 判斷是否為直接執行（非 import）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDatabase("countdown.db");
  console.log("資料庫已就緒：countdown.db");

  const server = createServer(createRequestHandler(db));
  server.listen(PORT, () => {
    console.log(`伺服器啟動於 http://localhost:${PORT}`);
  });
}
