# 研究報告：倒數計時器

**日期**：2026-06-28
**功能**：`002-countdown-timer`

---

## 決策 1：前端技術

**決定**：原生 HTML/CSS/JavaScript，無任何框架

**理由**：

- 使用者明確要求「最少的套件，盡可能使用原生 HTML CSS JavaScript」
- 倒數計時器邏輯簡單：DOM 操作 + 定時器（`setInterval`）+ API 呼叫（`fetch`），不需要框架帶來的虛擬 DOM 或元件系統
- 原生 `fetch` API、`setInterval`、`localStorage` 等現代瀏覽器 API 已足夠
- 避免引入 React/Vue/Svelte 等的建置步驟（Webpack/Vite 等）

**排除的替代方案**：

- Next.js（constitution 預設）：過度複雜，需要 Node + npm + 建置步驟
- Vue.js：需要安裝套件，與零依賴目標衝突
- 純靜態 HTML 無伺服器：無法支援 SQLite（只能用 localStorage/IndexedDB）

---

## 決策 2：儲存技術

**決定**：Node.js 22+ 內建 `node:sqlite` 模組（零 npm 依賴）

**理由**：

- 使用者明確要求「資料儲存在本地 SQLite」
- Node.js 22.5.0（2024-07 發布）正式加入內建 SQLite 支援（`node:sqlite`）
- 完全零外部依賴——不需安裝 `better-sqlite3`、`sqlite3` 或 `sql.js`
- SQLite 資料庫儲存為單一 `.db` 檔案於本機，使用者可直接備份或刪除
- SQL 查詢全程使用 `prepare().run(params)` 方式（參數化查詢），符合 constitution Principle IV 的 SQL injection 防禦要求

**排除的替代方案**：

- `localStorage`：非 SQLite，且有 5MB 容量限制，不符合使用者要求
- `IndexedDB`：非 SQLite，API 複雜，不符合要求
- `sql.js`（WASM SQLite）：需要下載 npm 套件或 CDN 資源，違反最少依賴原則
- `better-sqlite3`：需要 npm install + 原生模組編譯，違反最少依賴原則
- Neon PostgreSQL（constitution 預設）：雲端依賴，違反「本地儲存」要求

---

## 決策 3：伺服器

**決定**：Node.js 22+ 內建 `node:http` 模組，提供靜態檔案服務 + REST API

**理由**：

- 完全使用 Node.js 內建模組（`node:http`、`node:fs`、`node:path`、`node:sqlite`、`node:url`）
- 零 npm 依賴——不需要 Express、Fastify、或任何 HTTP 框架
- 對於本地開發工具而言，效能完全足夠（單一使用者）
- 伺服器職責明確：靜態檔案服務 + 3 個 REST API 端點

**排除的替代方案**：

- Express.js：需要 `npm install`，但 feature set 對本需求而言過度
- Fastify：同上
- Python `http.server`：無法直接整合 Node.js 的 `node:sqlite`
- 無伺服器（純靜態）：無法支援 SQLite 資料庫操作

---

## 決策 4：測試工具

**決定**：Node.js 22+ 內建 `node:test` 測試框架 + `node:assert`

**理由**：

- Node.js 18+ 已提供穩定的內建測試框架，語法接近 Jest/Mocha（`test()`, `describe()`）
- 零 npm 依賴，執行方式：`node --test tests/`
- 足以覆蓋本功能的 DB 層單元測試與 API 整合測試
- constitution Principle III 要求 TDD，`node:test` 完全支援 Red-Green-Refactor 循環

**排除的替代方案**：

- Vitest（constitution 預設）：需要 npm install，違反最少依賴原則；本功能已另行文件化此偏離
- Jest：需要 npm install，違反原則
- Playwright E2E：constitution 要求但為此功能的奢侈投入；本功能僅含 3 個使用者故事

---

## 決策 5：套件管理

**決定**：無 package.json，完全使用 Node.js 22+ 內建模組

**理由**：

- 最純粹的「零外部依賴」做法
- 無需 `npm install`、無 `node_modules` 目錄、無 lock file
- 啟動方式：`node server.js`，開箱即用
- 若未來需要加入依賴，再補 package.json 即可

**版本需求**：Node.js 22.5.0 以上（`node:sqlite` 的最低版本要求）

---

## 技術選型彙整

| 層級 | 選定方案 | 外部依賴數 |
|------|---------|-----------|
| 前端 UI | 原生 HTML + CSS + JS | 0 |
| 後端伺服器 | `node:http` | 0 |
| 資料庫 | `node:sqlite` (Node 22+) | 0 |
| 測試 | `node:test` + `node:assert` | 0 |
| **合計** | **完全零 npm 依賴** | **0** |

---

## 與 Constitution 偏離說明

| 偏離項目 | Constitution 預設 | 本功能選擇 | 理由 |
|---------|-----------------|----------|------|
| 前端框架 | Next.js 16 + TypeScript + Tailwind | 原生 HTML/CSS/JS | 使用者明確要求；倒數計時器為工具類功能，無需框架 |
| 資料庫 | Neon PostgreSQL + Drizzle ORM | 本地 SQLite (node:sqlite) | 使用者明確要求；本地儲存且無需雲端連線 |
| 測試工具 | Vitest + Playwright | node:test + node:assert | 維持零依賴；核心 TDD 原則不變 |

**Principle IV（Data Privacy）補充**：Principle IV 規定學習進度資料必須存入 Neon PostgreSQL，但倒數計時器的「活動資料」不屬於學習進度資料（非詞彙、語法、SRS 間隔等），因此使用本地 SQLite 不違反此原則的意圖。
