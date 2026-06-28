# user-comments Spec Workflow — Session Prompt Log

**日期**：2026-06-28  
**工具**：`@pimzino/claude-code-spec-workflow`  
**功能**：法語學習 App — 使用者評論系統（兩層巢狀留言）  
**技術棧**：Node.js 22+ 零 npm 依賴（`node:sqlite` / `node:http` / `node:test`）

---

## Task 1 — 建立目錄結構與模組設定

**Skill**：`/user-comments-task-1`  
**輸出**：`user-comments/package.json`  
**提示詞重點**：

- 建立 `{"type":"module"}` 啟用 ESM
- 不安裝任何 npm 套件，零依賴原則

---

## Task 2 — 實作 `createDatabase`：schema 初始化與種子資料

**Skill**：`/user-comments-task-2`  
**輸出**：`user-comments/db.js`（部分）  
**提示詞重點**：

- 使用 `node:sqlite` 的 `DatabaseSync`（同步 API，非 Promise）
- `PRAGMA foreign_keys = ON` 必須在 CREATE TABLE **之前**執行（CASCADE DELETE 的必要條件）
- 建立 `articles` + `comments` 兩張資料表
- `INSERT OR IGNORE` 插入 3 筆種子文章（Les salutations / Les nombres 1-20 / Les couleurs）

---

## Task 3 — 實作 DB 讀取函式

**Skill**：`/user-comments-task-3`  
**輸出**：`user-comments/db.js`（讀取函式）  
**提示詞重點**：

- `getAllArticles(db)`：依 `id ASC` 排序
- `getArticleById(db, id)`：不存在回傳 `undefined`
- `getCommentsByArticle(db, articleId)`：依 `created_at ASC`，回傳平坦陣列（巢狀組裝交給 server 層）
- `rows ?? []` 防止 `node:sqlite` 空結果回傳 `undefined`

---

## Task 4 — 實作 DB 寫入函式（含完整驗證）

**Skill**：`/user-comments-task-4`  
**輸出**：`user-comments/db.js`（寫入函式）  
**提示詞重點**：

- `addComment(db, articleId, content, parentId)`：
  - `isReply = parentId !== null && parentId !== undefined`
  - 驗證順序：空白 → 超 500 字 → 文章存在 → parent 存在 → 防三層巢狀
  - 頂層錯誤訊息：「評論內容不可為空白」/ 「評論不可超過 500 字元」
  - 回覆錯誤訊息：「回覆內容不可為空白」/ 「回覆不可超過 500 字元」
  - `created_at = new Date().toLocaleString("sv-SE").slice(0, 16)` → `"YYYY-MM-DD HH:MM"`
- `deleteComment(db, commentId)`：回傳 `result.changes > 0`（boolean）

---

## Task 5 — 建立 DB 層單元測試

**Skill**：`/user-comments-task-5`  
**輸出**：`user-comments/tests/db.test.js`  
**提示詞重點**：

- 使用 `node:test` + `node:assert/strict`（零依賴）
- 每個 test 呼叫 `makeDb()` 取得 `:memory:` DB，`after(() => db.close())` 清理
- 13 個測試案例全數覆蓋：seed data、頂層/回覆 happy path、所有 validation error、CASCADE DELETE

**測試結果**：13/13 PASS ✅

---

## Task 6 — 建立 `server.js`：輔助函式 + 靜態資源服務

**Skill**：`/user-comments-task-6`  
**輸出**：`user-comments/server.js`（骨架）  
**提示詞重點**：

- 複製 `countdown-timer/server.js` 的 `readBody` / `sendJson` 模式（各自維護，不共用 import）
- `createRequestHandler(db)` 工廠函式：讓整合測試注入 `:memory:` DB
- `STATIC_FILES` 對應 `/` / `/style.css` / `/app.js`
- PORT = 3001（避免與 countdown-timer:3000 衝突）

---

## Task 7 — 實作 API 路由至 `server.js`

**Skill**：`/user-comments-task-7`  
**輸出**：`user-comments/server.js`（4 個路由）  
**提示詞重點**：

- `GET /api/articles` → `getAllArticles(db)` 直接回傳
- `GET /api/articles/:id/comments` → 兩遍掃描組裝巢狀：
  1. 第一遍：所有評論放入 `Map<id, {...c, replies:[]}>`
  2. 第二遍：依 `parent_id` 分類為 topLevel 或 parent.replies
- `POST /api/articles/:id/comments` → 錯誤分類：「文章不存在」/「原評論不存在」→ 404，其餘 → 400
- `DELETE /api/comments/:id` → ID 非正整數 → 400，刪除成功 → `{ deleted: true, id }`
- GET 和 POST 共用同一個 regex match，用 `method` 區分

---

## Task 8 — 建立 API 整合測試

**Skill**：`/user-comments-task-8`  
**輸出**：`user-comments/tests/api.test.js`  
**提示詞重點**：

- `server.listen(0)` → OS 自動分配隨機 port（避免衝突）
- 每個 test 獨立的 server + `:memory:` DB 實例（測試隔離性）
- `after(() => { server.close(); db.close(); })` 非同步清理
- Node.js 22+ 內建 `fetch`（不需 import）
- 16 個測試案例：涵蓋 4 個端點的全部 happy path + error case + CASCADE DELETE 驗證

**測試結果**：16/16 PASS ✅

---

## Task 9 — 建立 HTML/CSS 前端

**Skill**：`/user-comments-task-9`  
**輸出**：`user-comments/index.html` + `user-comments/style.css`  
**提示詞重點**：

- Header + 左側 Sidebar（`<aside>`）+ 右側 Main 的三欄佈局（`display: flex`）
- 關鍵 DOM 元素：`#article-nav` / `#article-detail` / `#comments-list` / `#new-comment` / `#submit-comment`
- `.hidden { display: none; }` 控制 `.reply-form` 顯示
- `.comment.reply` 縮排（`margin-left: 2rem`）
- 藍白法語學習主題，`@media (max-width: 767px)` 響應式

---

## Task 10 — 實作前端 `app.js`

**Skill**：`/user-comments-task-10`  
**輸出**：`user-comments/app.js`  
**提示詞重點**：

- ESM 模組（`type="module"` 已在 HTML 設定）
- Event Delegation：在 `#comments-list` 設一個 click 監聽，用 `e.target.closest()` 區分四種按鈕
- **XSS 防禦強制**：所有評論內容用 `element.textContent`，絕對不用 `innerHTML`
- 回覆層（`isReply=true`）不生成 `.btn-reply` 和 `.reply-form`（僅支援兩層）
- 全域 `currentArticleId` 追蹤選中文章，操作完成後重新 `loadComments()` 刷新

---

## 最終驗證

| 驗證項目 | 結果 |
|---------|------|
| DB 單元測試 (13 個) | ✅ 全部通過 |
| API 整合測試 (16 個) | ✅ 全部通過 |
| Puppeteer 前端截圖 (5 張) | ✅ 全部通過 |
| 伺服器啟動（port 3001） | ✅ 正常 |

---

## 產出檔案清單

```
user-comments/
├── package.json          ({"type":"module"})
├── db.js                 (createDatabase + 5 函式)
├── server.js             (4 API 路由 + 靜態資源)
├── index.html            (三欄佈局 HTML 骨架)
├── style.css             (藍白主題 + 縮排評論)
├── app.js                (fetch + DOM + event delegation)
└── tests/
    ├── db.test.js        (13 個 DB 單元測試)
    └── api.test.js       (16 個 API 整合測試)
```
