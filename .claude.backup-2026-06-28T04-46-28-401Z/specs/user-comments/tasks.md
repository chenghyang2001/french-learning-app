# 實作任務清單：使用者評論系統

## 任務概覽

建立 `user-comments/` 功能目錄，實作兩層巢狀評論系統：DB 存取層 → HTTP 伺服器 → 前端 UI。共 10 個原子任務，依序執行。

## Steering Document Compliance

本任務清單遵循以下技術慣例：

- **零 npm 依賴**：所有任務使用 Node.js 22+ 內建模組（`node:sqlite`、`node:http`、`node:test`）
- **扁平目錄結構**：沿用 `countdown-timer/` 的五檔案 + `tests/` 子目錄慣例
- **可測試性**：`createRequestHandler(db)` 工廠模式讓所有 API 測試可注入 `:memory:` DB
- **參數化查詢**：所有 DB 操作使用 `db.prepare(...).run(...)` 防 SQL Injection

## Task Format Guidelines

- Checkbox 格式：`- [ ] N. 任務描述`
- 指定確切檔案路徑（相對於專案根目錄）
- `_Requirements: N AC#_` 引用需求；`_Leverage: path/to/file_` 引用既有產物
- 每個任務只處理一件事，最多觸及 1-3 個相關檔案

## 原子任務標準

每個任務符合以下條件：

- **檔案範圍**：最多觸及 1-3 個相關檔案
- **時間估算**：15-30 分鐘可完成
- **單一交付物**：一個可獨立測試的功能點
- **明確路徑**：指定確切的建立/修改檔案

---

## 任務

- [x] 1. 建立目錄結構與模組設定
  - 檔案：`user-comments/package.json`、`user-comments/tests/.gitkeep`
  - 建立 `user-comments/` 目錄
  - 建立 `package.json` 設定 `"type": "module"`（啟用 ESM import/export）
  - 建立 `tests/` 子目錄（空）
  - 目的：確立 ESM 模組環境，讓後續 `import { DatabaseSync } from "node:sqlite"` 可正常運作
  - _Requirements: 技術約束（零 npm 依賴、Node.js 22+ ESM）_

- [x] 2. 實作 `createDatabase`：schema 初始化與種子資料
  - 檔案：`user-comments/db.js`（新建）
  - 建立 `createDatabase(dbPath)` 函式：
    - 執行 `PRAGMA foreign_keys = ON`（啟用 CASCADE DELETE，**必須在建表前執行**）
    - CREATE TABLE IF NOT EXISTS `articles`（4 欄：id, title, content, created_at）
    - CREATE TABLE IF NOT EXISTS `comments`（5 欄 + FOREIGN KEY + CHECK 約束）
    - INSERT OR IGNORE 3 筆種子法語文章（Les salutations / Les nombres 1-20 / Les couleurs）
  - 只匯出 `createDatabase`，其他函式在後續任務加入
  - 目的：建立可測試的資料庫基礎，種子資料確保後續 API 測試不依賴手動建資料
  - _Requirements: 需求 1 AC5（文章存在性驗證前提）、需求 4 AC2（CASCADE DELETE）_

- [ ] 3. 實作 DB 讀取函式
  - 檔案：`user-comments/db.js`（繼續 Task 2）
  - 新增三個匯出函式：
    - `getAllArticles(db)`：SELECT * FROM articles ORDER BY id ASC
    - `getArticleById(db, articleId)`：SELECT 單筆，不存在回傳 undefined
    - `getCommentsByArticle(db, articleId)`：SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC（平坦陣列，巢狀組裝由 server 負責）
  - 目的：提供查詢介面，讓 server 層可以驗證文章存在性並取得評論
  - _Leverage: user-comments/db.js（Task 2 建立的 createDatabase）_
  - _Requirements: 需求 2 AC1（升冪排列）、需求 2 AC3（空陣列）_

- [ ] 4. 實作 DB 寫入函式（含完整驗證）
  - 檔案：`user-comments/db.js`（繼續 Task 3）
  - 新增兩個匯出函式：
    - `addComment(db, articleId, content, parentId)`：
      - 驗證 content（trim 後非空、≤ 500 字元；錯誤訊息依 parentId 是否為 null 而不同）
      - 驗證 articleId 存在（呼叫 getArticleById）
      - 若 parentId 非 null：驗證 parent 存在且其 parent_id 為 null（防三層巢狀）
      - INSERT 後查回完整 row 並回傳
    - `deleteComment(db, commentId)`：DELETE WHERE id = ?，回傳 boolean（changes > 0）
  - 目的：集中所有驗證邏輯於 DB 層，server 層只需 catch Error 並對應 HTTP 狀態碼
  - _Leverage: user-comments/db.js（Task 3 的讀取函式）_
  - _Requirements: 需求 1 AC2/AC3（空白/超字數）、需求 3 AC3/AC4/AC6/AC7、需求 4 AC1/AC2_

- [ ] 5. 建立 DB 層單元測試
  - 檔案：`user-comments/tests/db.test.js`（新建）
  - 使用 `node:test` + `node:assert` + `:memory:` DB
  - 測試案例：
    - `createDatabase`：兩張表建立成功、種子文章存在（3 筆）
    - `addComment` happy path：新增頂層評論（parent_id = null）
    - `addComment` happy path：新增回覆（parent_id = 有效 id）
    - `addComment` 錯誤：空白頂層評論 → throw "評論內容不可為空白"
    - `addComment` 錯誤：空白回覆 → throw "回覆內容不可為空白"
    - `addComment` 錯誤：超 500 字頂層 → throw "評論不可超過 500 字元"
    - `addComment` 錯誤：article_id 不存在 → throw "文章不存在"
    - `addComment` 錯誤：parent_id 不存在 → throw "原評論不存在"
    - `addComment` 錯誤：嘗試三層巢狀 → throw "不支援對回覆再次回覆"
    - `getCommentsByArticle`：無評論 → 空陣列、有評論 → 依 created_at ASC
    - `deleteComment`：刪頂層 → 子回覆被 CASCADE 刪除、id 不存在 → false
  - 執行：`node --test tests/db.test.js`（在 `user-comments/` 目錄下）
  - _Leverage: user-comments/db.js_
  - _Requirements: 需求 1、需求 3、需求 4 全部 AC_

- [ ] 6. 建立 `server.js`：輔助函式 + 靜態資源服務
  - 檔案：`user-comments/server.js`（新建）
  - 包含：
    - `readBody(req)`：讀取 request body，超 1 MB 拒絕（複製自 countdown-timer/server.js:66）
    - `sendJson(res, status, data)`：統一 JSON 回應（複製自 countdown-timer/server.js:88）
    - STATIC_FILES 對照表：`/` → `index.html`、`/style.css`、`/app.js`
    - `createRequestHandler(db)` 骨架：只處理靜態資源 + 404 fallback
    - 主程式啟動區塊（port 3001）
  - 目的：建立可啟動的伺服器骨架，API 路由在 Task 7 加入
  - _Leverage: countdown-timer/server.js（複用 readBody + sendJson 模式）_
  - _Requirements: 技術約束（createRequestHandler 工廠模式供測試注入）_

- [ ] 7. 實作 API 路由至 `server.js`
  - 檔案：`user-comments/server.js`（繼續 Task 6）
  - 在 `createRequestHandler` 中加入 4 個 API 路由：
    - `GET /api/articles`：呼叫 getAllArticles，回傳 200
    - `GET /api/articles/:id/comments`：呼叫 getCommentsByArticle，組裝巢狀結構（parent_id 分群），回傳 200
    - `POST /api/articles/:id/comments`：解析 body，呼叫 addComment，成功 201；catch Error → 依訊息判斷 400（驗證錯誤）或 404（資源不存在）
    - `DELETE /api/comments/:id`：驗證 id 為正整數，呼叫 deleteComment，成功 200；不存在 404；非整數 400
    - **外層 try/catch**：`createRequestHandler` 最外層 catch 任何未預期錯誤 → `console.error("[server error]", err)` + 回傳 500 `{ error: "伺服器錯誤，請稍後再試" }`（不洩漏內部細節）
  - 目的：完成完整 REST API，讓前端與整合測試可以呼叫
  - _Leverage: user-comments/db.js、user-comments/server.js（Task 6 骨架）_
  - _Requirements: 需求 1、需求 2、需求 3、需求 4 全部 AC_

- [ ] 8. 建立 API 整合測試
  - 檔案：`user-comments/tests/api.test.js`（新建）
  - 使用 `node:test` + `node:http` + `:memory:` DB（透過 createRequestHandler 注入）
  - 測試案例：
    - `GET /api/articles`：回傳 3 筆種子文章
    - `GET /api/articles/1/comments`：無評論時回傳空陣列、有評論時回傳巢狀結構
    - `POST /api/articles/1/comments`（頂層）：201 + 回傳新評論 JSON
    - `POST /api/articles/1/comments`（回覆）：body 含 parent_id，201 + 回傳回覆 JSON
    - `POST /api/articles/1/comments`（空白頂層）：400 "評論內容不可為空白"
    - `POST /api/articles/1/comments`（空白回覆）：400 "回覆內容不可為空白"
    - `POST /api/articles/1/comments`（超 500 字）：400
    - `POST /api/articles/999/comments`：404 "文章不存在"
    - `POST /api/articles/1/comments`（parent_id 不存在）：404 "原評論不存在"
    - `POST /api/articles/1/comments`（三層巢狀嘗試）：400
    - `DELETE /api/comments/1`：200、確認 CASCADE 刪除子回覆
    - `DELETE /api/comments/999`：404
    - `DELETE /api/comments/abc`：400 "無效的評論 ID"
  - 執行：`node --test tests/api.test.js`（在 `user-comments/` 目錄下）
  - _Leverage: user-comments/server.js、user-comments/db.js_
  - _Requirements: 需求 1 AC2/AC3/AC4/AC5、需求 3 AC3/AC4/AC6、需求 4 AC3/AC4_

- [ ] 9. 建立 `index.html` 與 `style.css`
  - 檔案：`user-comments/index.html`（新建）、`user-comments/style.css`（新建）
  - `index.html` 結構：
    - `<select id="article-select">` — 文章選單（動態填入）
    - `<article id="article-content">` — 文章標題與內容
    - `<section id="comments-section">` — 評論列表容器
    - `<form id="comment-form">` — 新增頂層評論表單（textarea + 送出按鈕）
    - `<template id="comment-tpl">` — 評論卡片模板（含回覆/刪除按鈕）
  - `style.css` 重點：
    - `.comment`：頂層評論樣式
    - `.reply`：回覆縮排（`margin-left: 2rem`）
    - `.reply-form`：預設 `display: none`，JS 控制顯示
    - `.empty-state`：空狀態提示樣式
  - 目的：提供 DOM 結構，app.js 在 Task 10 實作互動邏輯
  - _Requirements: 需求 2 AC2（縮排）、需求 3 AC1（回覆按鈕）_

- [ ] 10. 建立 `app.js`：前端互動邏輯
  - 檔案：`user-comments/app.js`（新建）
  - 實作以下函式：
    - `loadArticles()`：GET /api/articles → 填入 `<select>`，自動選第一篇並呼叫 loadComments
    - `loadComments(articleId)`：GET /api/articles/:id/comments → 呼叫 renderComments
    - `renderComments(comments)`：
      - 空陣列 → 顯示 `<p class="empty-state">尚無評論，來發表第一則吧！</p>`
      - 非空 → 遍歷頂層評論，用 `textContent`（防 XSS）填入內容與時間；對每個頂層評論的 `replies` 陣列遞迴渲染（縮排）；回覆層不渲染回覆按鈕
    - `showReplyForm(commentId)`：顯示對應回覆表單並 `textarea.focus()`
    - `hideReplyForm(commentId)`：隱藏並清空回覆表單
    - `submitComment(articleId, content, parentId)`：POST，**成功後清空 `<textarea>` 內容**並呼叫 loadComments 重新整理；失敗顯示錯誤訊息（不清空輸入框）
    - `deleteComment(commentId, articleId)`：DELETE，成功後呼叫 loadComments
  - textarea `input` 事件：即時更新送出按鈕 `disabled` 狀態
  - 目的：完成完整使用者互動流程
  - _Leverage: user-comments/index.html（Task 9 的 DOM 結構）_
  - _Requirements: 需求 1 全部 AC、需求 2 全部 AC、需求 3 AC1/AC5、需求 4 AC1_
