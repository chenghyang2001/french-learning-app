# Session 1 Summary — 2026-06-28

## 概覽

本次 session 為 french-learning-app 專案的倒數計時器（`countdown-timer`）功能，走完 SpecKit 完整生命週期（specify → plan → tasks → implement）並成功實作所有源碼，通過 17 個自動化測試。

---

## 完成事項

### SpecKit 流程（上半段 session，從前次 context 接續）

- **`/speckit-specify`**：產出 `specs/002-countdown-timer/spec.md`（3 個 User Story：US1 新增倒數、US2 多活動管理刪除、US3 到期標記）；requirements checklist 16/16 全通過
- **`/speckit-plan`**（使用者參數：`應用程式使用最少的套件，盡可能使用原生 HTML CSS JavaScript，資料儲存在本地 SQLite`）：產出 plan.md、data-model.md、contracts/api.md、quickstart.md、research.md；技術決策為零 npm 依賴 + `node:sqlite` + `node:http` + `node:test`（全 Node.js 22.5+ 內建）；Constitution 6 條原則全通過（Principle II = N/A for utility feature）
- **`/speckit-tasks`**：產出 34 個任務（T001-T034），分 6 個階段，含 TDD 檢查點（T008-T009、T020、T026）

### 實作（本次 session 主體）

- 三 agent 鐵律流程（code-writer → code-qa → code-reviewer），complex 複雜度，20+ QA 驗證項目
- **豁免直寫**（.html/.css/.gitignore 不在觸發清單）：index.html、style.css、.gitignore、package.json（`{"type":"module"}`）
- **code-writer 第一輪**：5 個 .js 檔（tests/db.test.js、db.js、server.js、app.js、tests/api.test.js）全部寫入磁碟，SHA256 全部吻合
- **code-qa 第一輪**：5/5 PASS，動態執行 pass: 17（db: 7 + api: 10），V5 SKIP（eslint 未安裝）
- **code-reviewer（第一輪）**：CHANGES_REQUESTED，5 個 MUST_FIX：
  1. `app.js` `innerHTML = ""` → `replaceChildren()`
  2. 刪除前缺 `window.confirm` 確認
  3. 表單送出未 disable 按鈕防重送
  4. `computeCountdown` 缺 `isNaN()` 防禦（NaN 洩漏到前端）
  5. `api.test.js` describe 缺 `{concurrency: false}`
- **code-writer 第二輪（修正）**：3 個檔案修正完成
- **code-qa 第二輪**：3/3 PASS，修正項目全部確認
- **最終測試結果**：`node --test tests/db.test.js tests/api.test.js` → pass: 17 / fail: 0

---

## 關鍵技術筆記

### `node:sqlite` 使用注意

- **同步 API**（`DatabaseSync`），不是 Promise/async，與 Node.js 其他 I/O 模組截然不同
- Node.js 22 仍是 ExperimentalWarning，但功能完整穩定
- 測試用 `:memory:` 路徑建立記憶體 DB，每測試獨立無污染

### Node.js 24 vs 22 行為差異

- `node --test tests/` 在 Node.js 24（本機 v24.13.1）把目錄路徑當 CJS module 解析而非 glob，報 `MODULE_NOT_FOUND`
- 解法：明確指定檔案 `node --test tests/db.test.js tests/api.test.js`
- quickstart.md 已更新正確指令

### `package.json` 的作用

- 零 npm 依賴的專案仍需 `{"type":"module"}` 告知 Node.js 使用 ESM，消除 `MODULE_TYPELESS_PACKAGE_JSON` 警告

### 時區假設（架構決策）

- `target_at` 以 `YYYY-MM-DDTHH:MM`（無時區）格式儲存，`computeCountdown` 用 `new Date()` 取伺服器當地時間
- localhost 開發無問題，若部署到 UTC 伺服器、使用者在 UTC+8 瀏覽器會有時區差異
- 已由 code-reviewer 點出，記錄於 ARCHITECTURE_CONCERNS，spec 應明確說明「本地時間假設」

---

## 產出檔案

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `specs/002-countdown-timer/spec.md` | 功能規格（3 US）| ✅ 已完成（前次） |
| `specs/002-countdown-timer/plan.md` | 實作計畫（含 Constitution check）| ✅ 已完成（前次） |
| `specs/002-countdown-timer/data-model.md` | SQLite schema 定義 | ✅ 已完成（前次） |
| `specs/002-countdown-timer/contracts/api.md` | REST API 合約 | ✅ 已完成（前次） |
| `specs/002-countdown-timer/quickstart.md` | 驗證指南（修正測試指令）| ✅ 已完成 |
| `specs/002-countdown-timer/tasks.md` | 34 個任務（T001-T033 已完成）| ✅ T033 標記完成 |
| `countdown-timer/.gitignore` | 排除 countdown.db | ✅ |
| `countdown-timer/package.json` | `{"type":"module"}` | ✅ |
| `countdown-timer/index.html` | 主要 HTML（含 aria 無障礙）| ✅ |
| `countdown-timer/style.css` | 活動卡片樣式（active/expired）| ✅ |
| `countdown-timer/db.js` | SQLite 資料層（參數化查詢）| ✅ |
| `countdown-timer/server.js` | HTTP 伺服器 + API 路由（NaN 防禦）| ✅ |
| `countdown-timer/app.js` | 前端邏輯（replaceChildren/confirm/disable）| ✅ |
| `countdown-timer/tests/db.test.js` | 7 個 DB 單元測試 | ✅ pass: 7 |
| `countdown-timer/tests/api.test.js` | 10 個 API 整合測試 | ✅ pass: 10 |

---

## HANDOFF（下次 session 優先處理）

### 立即行動

- [ ] **T034 手動 quickstart 瀏覽器驗證**：執行 `cd countdown-timer && node server.js`，在瀏覽器開啟 `http://localhost:3000`，逐一跑 quickstart.md 的 7 個情境（空頁面、新增倒數、自動更新、過期活動、刪除、重整保留、表單驗證）
- [ ] **時區說明補充**：在 spec.md 的 Assumptions 區塊明確記錄「本地時間假設：伺服器與瀏覽器在同一時區才能正確計算倒數」
- [ ] **下一個 SpecKit 功能**：使用者可繼續選下一個法語學習 app 功能（如單字測驗、發音練習等）

### 進行中（需接續）

- 倒數計時器功能本體已完整實作（17 個測試全通過），僅剩 T034 手動驗證未做
- french-learning-app 整體尚未有其他功能（vocab-quiz 在 specs/001-vocab-quiz 只有 spec，未實作）

### 注意事項

- 本機 Node.js 版本為 v24.13.1（非 v22.5.0），`node:sqlite` 仍標記 ExperimentalWarning 但功能正常
- `node --test tests/` 在 v24 不支援目錄路徑，必須用 `node --test tests/db.test.js tests/api.test.js`
- eslint 已安裝（v10.6.0）但專案無 `.eslintrc` 設定檔，V5 lint 目前 SKIP
- SpecKit 的 Constitution 加了 Principle VI（文件語言必須繁體中文）—— 這是本 session 之前加的，已驗證有效
