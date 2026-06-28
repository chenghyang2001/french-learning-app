/**
 * server.js — HTTP 伺服器（使用者留言系統）
 *
 * 靜態資源服務 + API 路由骨架。
 * API 路由由 Task 7 填入，此檔僅建立伺服器結構。
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  getAllArticles,
  getArticleById,
  getCommentsByArticle,
  addComment,
  deleteComment,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;

/**
 * 讀取請求 body（最大 1 MB）。
 *
 * @param {import("node:http").IncomingMessage} req
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

/**
 * 回傳 JSON 回應。
 *
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} data
 */
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/** 靜態資源對應表 */
const STATIC_FILES = {
  "/": { file: "index.html", mime: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", mime: "text/css; charset=utf-8" },
  "/app.js": {
    file: "app.js",
    mime: "application/javascript; charset=utf-8",
  },
};

/**
 * 建立請求處理器工廠函式。
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => Promise<void>}
 */
export function createRequestHandler(db) {
  return async function requestHandler(req, res) {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    const method = req.method;

    try {
      // Route 1: GET /api/articles
      if (method === "GET" && pathname === "/api/articles") {
        const articles = getAllArticles(db);
        return sendJson(res, 200, articles);
      }

      // Route 2 & 3: GET/POST /api/articles/:id/comments（共用同一 regex match，用 method 區分）
      const articleCommentsMatch = pathname.match(
        /^\/api\/articles\/([^/]+)\/comments$/,
      );
      if (articleCommentsMatch) {
        const articleId = Number(articleCommentsMatch[1]);
        if (!Number.isInteger(articleId) || articleId <= 0) {
          return sendJson(res, 400, { error: "無效的文章 ID" });
        }

        if (method === "GET") {
          // 驗證文章存在
          const article = getArticleById(db, articleId);
          if (!article) {
            return sendJson(res, 404, { error: "文章不存在" });
          }

          // 取得平坦評論陣列，用兩遍掃描組裝巢狀結構
          const flatComments = getCommentsByArticle(db, articleId);

          const commentMap = new Map();
          const topLevel = [];

          // 第一遍：所有評論加入 Map，初始化 replies 陣列
          for (const c of flatComments) {
            commentMap.set(c.id, { ...c, replies: [] });
          }

          // 第二遍：依 parent_id 分類為頂層或子評論
          for (const c of commentMap.values()) {
            if (c.parent_id === null) {
              topLevel.push(c);
            } else {
              const parent = commentMap.get(c.parent_id);
              if (parent) parent.replies.push(c);
            }
          }

          return sendJson(res, 200, topLevel);
        }

        if (method === "POST") {
          let parsed;
          try {
            const raw = await readBody(req);
            parsed = JSON.parse(raw);
          } catch {
            return sendJson(res, 400, {
              error: "請求格式錯誤，需為有效的 JSON",
            });
          }

          const { content, parent_id } = parsed ?? {};
          // parent_id 未提供時傳 null（頂層評論）
          const parentId = parent_id !== undefined ? parent_id : null;

          try {
            const comment = addComment(db, articleId, content, parentId);
            return sendJson(res, 201, comment);
          } catch (err) {
            // "文章不存在" / "原評論不存在" → 404，其餘（空白、超字數、三層巢狀）→ 400
            const is404 =
              err.message === "文章不存在" || err.message === "原評論不存在";
            return sendJson(res, is404 ? 404 : 400, { error: err.message });
          }
        }
      }

      // Route 4: DELETE /api/comments/:id
      const deleteCommentMatch = pathname.match(/^\/api\/comments\/([^/]+)$/);
      if (method === "DELETE" && deleteCommentMatch) {
        const commentId = Number(deleteCommentMatch[1]);
        if (!Number.isInteger(commentId) || commentId <= 0) {
          return sendJson(res, 400, { error: "無效的評論 ID" });
        }

        const deleted = deleteComment(db, commentId);
        if (!deleted) {
          return sendJson(res, 404, { error: "評論不存在" });
        }
        return sendJson(res, 200, { deleted: true, id: commentId });
      }

      // 靜態資源
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

      // 404
      sendJson(res, 404, { error: "找不到該路徑" });
    } catch (err) {
      console.error("[server error]", err);
      sendJson(res, 500, { error: "伺服器錯誤，請稍後再試" });
    }
  };
}

// 主程式啟動（直接執行此檔案時才啟動伺服器，被 import 時略過）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDatabase("comments.db");
  console.log("資料庫已就緒：comments.db");
  const server = createServer(createRequestHandler(db));
  server.listen(PORT, () => {
    console.log(`伺服器啟動於 http://localhost:${PORT}`);
  });
}
