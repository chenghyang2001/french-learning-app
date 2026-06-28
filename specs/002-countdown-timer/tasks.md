---

description: "倒數計時器功能任務清單"

---

# 任務清單：倒數計時器

**輸入**：設計文件來自 `specs/002-countdown-timer/`

**前置條件**：plan.md ✅ · spec.md ✅ · data-model.md ✅ · contracts/api.md ✅ · research.md ✅

**技術堆疊**：原生 HTML/CSS/JS + Node.js 22.5+ 內建模組（零 npm 依賴）

**根目錄**：所有源碼路徑均相對於 `countdown-timer/`（位於 repo 根目錄）

## 格式：`[ID] [P?] [故事?] 描述 - 檔案路徑`

- **[P]**：可平行執行（不同檔案、無依賴關係）
- **[US1/2/3]**：對應使用者故事（P1=新增與顯示、P2=多活動管理、P3=到期標記）

---

## 第一階段：初始化（共用基礎設施）

**目標**：建立 `countdown-timer/` 目錄結構，為後續所有任務做好準備

- [x] T001 建立 `countdown-timer/` 根目錄及子目錄 `tests/`（依 plan.md 結構）
- [x] T002 [P] 建立 `countdown-timer/.gitignore`，排除 `countdown.db`、`*.log`、`node_modules/`（未來預防用）
- [x] T003 [P] 建立空白原始碼檔：`countdown-timer/index.html`、`countdown-timer/style.css`、`countdown-timer/app.js`、`countdown-timer/server.js`、`countdown-timer/db.js`

---

## 第二階段：基礎建設（阻塞所有使用者故事）

**目標**：建立共用的資料庫層與 HTTP 伺服器骨架，所有使用者故事均依賴此階段完成

**⚠️ 關鍵**：此階段完成前，不可開始任何使用者故事

- [x] T004 實作 `countdown-timer/db.js` 的 SQLite 初始化（使用 `node:sqlite` 開啟 `countdown.db` 連線，並以 `CREATE TABLE IF NOT EXISTS` 建立 `activities` 資料表，schema 見 data-model.md）
- [x] T005 實作 `countdown-timer/server.js` 的 HTTP 伺服器骨架（使用 `node:http` 建立伺服器，實作路由分派邏輯：靜態檔案路由 vs API 路由；啟動於 port 3000；印出啟動訊息）
- [x] T006 [P] 實作 `countdown-timer/server.js` 的靜態檔案服務（`GET /` → `index.html`，`GET /style.css`，`GET /app.js`；正確設定 Content-Type；404 處理）
- [x] T007 [P] 建立 `countdown-timer/index.html` 的 HTML 骨架（`<!DOCTYPE html>`、`lang="zh-TW"`、UTF-8 charset、引入 `style.css` 與 `app.js`、語義化容器 `<main>`）

**檢查點**：`node server.js` 可啟動，`http://localhost:3000` 回傳 HTML 頁面（T006 完成後驗證）

---

## 第三階段：使用者故事 1 - 新增活動並立即看到倒數（優先級：P1）🎯 MVP

**目標**：使用者可輸入活動名稱與目標日期，送出後即時看到倒數（天/小時/分鐘）

**獨立測試方式**：開啟 `http://localhost:3000`，新增「生日派對」並選擇明天的日期，確認倒數卡片出現且顯示正確剩餘時間

### 使用者故事 1 測試（Constitution Principle III — TDD 必須先寫失敗測試）⚠️

> **注意：必須先讓這些測試失敗，再開始實作 T009-T010**

- [x] T008 [US1] 在 `countdown-timer/tests/db.test.js` 撰寫 `addActivity` 的失敗測試（使用 `node:test`）：正常新增、名稱空白應拋錯、確認回傳含 id 的物件
- [x] T009 [P] [US1] 在 `countdown-timer/tests/db.test.js` 補充 `getAllActivities` 的失敗測試：空資料庫回傳空陣列、新增後可查詢、衍生欄位（status/countdown）計算正確

### 使用者故事 1 實作

- [x] T010 [US1] 實作 `countdown-timer/db.js` 的 `addActivity(name, targetAt)` 函式（參數化 INSERT、name 空白時拋出 Error、回傳含 id/name/target_at/created_at/status/countdown 的物件）
- [x] T011 [US1] 實作 `countdown-timer/db.js` 的 `getAllActivities()` 函式（查詢全部活動，計算衍生欄位：比較 target_at 與現在時間，得出 status='active'或'expired' 及 countdown.days/hours/minutes，依 target_at 升冪排序）
- [x] T012 [US1] 執行 `node --test tests/db.test.js` 確認 T008-T009 的測試全部通過（若失敗則修正 T010-T011）
- [x] T013 [US1] 實作 `countdown-timer/server.js` 的 `GET /api/activities` 端點（呼叫 `db.getAllActivities()`，回傳 `200 application/json` 陣列；伺服器錯誤回傳 500 不洩漏內部訊息）
- [x] T014 [US1] 實作 `countdown-timer/server.js` 的 `POST /api/activities` 端點（解析 JSON body、驗證 name 非空白 + target_at 格式、呼叫 `db.addActivity()`、回傳 `201`；驗證失敗回傳 `400` + 繁體中文錯誤訊息）
- [x] T015 [P] [US1] 在 `countdown-timer/index.html` 新增活動表單：`<input type="text">` 名稱欄位（`required`）、`<input type="datetime-local">` 目標日期（`required`）、`<button type="submit">新增</button>`、活動清單容器 `<ul id="activities-list">`
- [x] T016 [P] [US1] 在 `countdown-timer/style.css` 撰寫基礎樣式：頁面最大寬度置中、表單群組 flex 排版、提交按鈕樣式、活動卡片（`<li>`）外框與間距
- [x] T017 [US1] 在 `countdown-timer/app.js` 實作頁面載入時呼叫 `GET /api/activities` 並渲染活動清單（每個活動渲染為卡片，顯示名稱 + `X 天 Y 小時 Z 分鐘`；狀態為 'active' 時正常顯示）
- [x] T018 [US1] 在 `countdown-timer/app.js` 實作表單送出事件（`preventDefault`、呼叫 `POST /api/activities`、清空表單、重新渲染清單；顯示欄位驗證錯誤訊息）
- [x] T019 [US1] 在 `countdown-timer/app.js` 實作 `setInterval`（每 60,000 毫秒重新呼叫 GET 並更新 DOM，實現自動倒數更新）

**檢查點**：使用者故事 1 完整可用——新增活動後即見倒數，60 秒後自動更新，重新整理頁面後資料保留

---

## 第四階段：使用者故事 2 - 多活動管理與刪除（優先級：P2）

**目標**：使用者可同時顯示多個活動，並刪除不需要的項目

**獨立測試方式**：新增三個活動，確認各自顯示正確倒數；點擊刪除，確認僅該活動消失

### 使用者故事 2 測試（TDD）⚠️

- [x] T020 [US2] 在 `countdown-timer/tests/db.test.js` 補充 `deleteActivity` 的失敗測試：刪除存在的 ID 回傳 `true`、刪除不存在的 ID 回傳 `false`、刪除後 getAllActivities 不含該活動

### 使用者故事 2 實作

- [x] T021 [US2] 實作 `countdown-timer/db.js` 的 `deleteActivity(id)` 函式（參數化 DELETE、id 非整數時拋出 Error、存在時回傳 `true`、不存在時回傳 `false`）
- [x] T022 [US2] 執行 `node --test tests/db.test.js` 確認全部 DB 測試通過
- [x] T023 [US2] 實作 `countdown-timer/server.js` 的 `DELETE /api/activities/:id` 端點（從 URL 解析 id、驗證為整數、呼叫 `db.deleteActivity()`、存在回傳 `200 {"deleted":true,"id":N}`、不存在回傳 `404`、非整數回傳 `400`）
- [x] T024 [P] [US2] 在 `countdown-timer/app.js` 為每個活動卡片新增刪除按鈕，綁定 click 事件（呼叫 `DELETE /api/activities/:id`，成功後重新渲染清單）
- [x] T025 [P] [US2] 在 `countdown-timer/style.css` 補充刪除按鈕樣式（位於卡片右上角、hover 紅色），確保多張卡片清單的捲動與間距正確

**檢查點**：使用者故事 1 與 2 均可獨立運作——可新增、顯示多個、刪除特定活動

---

## 第五階段：使用者故事 3 - 到期活動標記（優先級：P3）

**目標**：目標日期已過的活動顯示「已到期」標記，而非負數倒數

**獨立測試方式**：新增一個目標日期為昨天的活動，確認顯示「已到期」而非負數

### 使用者故事 3 測試（TDD）⚠️

- [x] T026 [US3] 在 `countdown-timer/tests/db.test.js` 補充過期活動測試：新增目標日期為過去的活動，確認 `getAllActivities` 回傳 `status='expired'` 且 countdown 均為 0

### 使用者故事 3 實作

（注意：`status` 計算邏輯已在 T011 `getAllActivities` 中實作，本階段只需補充 UI 表現層）

- [x] T027 [US3] 執行 `node --test tests/db.test.js` 確認 T026 的到期測試通過（若 T011 已正確實作應直接通過）
- [x] T028 [US3] 修改 `countdown-timer/app.js` 的卡片渲染邏輯：`status === 'expired'` 時顯示「已到期」文字標記，而非「0 天 0 小時 0 分鐘」
- [x] T029 [US3] 在 `countdown-timer/style.css` 補充已到期卡片的視覺樣式（灰色或紅色標記、區別於倒數中的樣式）

**檢查點**：三個使用者故事均可獨立運作

---

## 第六階段：修飾與橫切關注點

**目標**：API 整合測試、無障礙性補強、最終驗證

- [x] T030 撰寫 `countdown-timer/tests/api.test.js` 的 API 層整合測試（使用 `node:test` + `node:http`；測試 `GET /api/activities` 回傳陣列、`POST` 回傳 201、`DELETE` 回傳 200、`POST` 缺欄位回傳 400、`DELETE` 不存在 ID 回傳 404）
- [x] T031 執行 `node --test tests/` 確認全部測試（db.test.js + api.test.js）均通過
- [x] T032 [P] 在 `countdown-timer/index.html` 補強無障礙屬性（`aria-label`、表單 `<label>` 與輸入框關聯、按鈕有描述性文字），符合 constitution Principle I（鍵盤與螢幕閱讀器可用）
- [x] T033 [P] 審查 `countdown-timer/server.js` 的錯誤處理（確認 500 錯誤回傳 `{"error":"伺服器錯誤，請稍後再試"}` 不洩漏 stack trace；確認全部端點均設定 `Content-Type: application/json`）
- [ ] T034 依 `quickstart.md` 逐一手動執行所有 7 個驗證情境，確認端對端行為正確

---

## 相依關係與執行順序

### 階段相依

- **初始化（第一階段）**：無依賴，立即開始
- **基礎建設（第二階段）**：依賴第一階段完成
- **使用者故事 1（第三階段）**：依賴基礎建設（T004、T005 完成）
- **使用者故事 2（第四階段）**：依賴使用者故事 1 完成（共用 db.js 基礎）
- **使用者故事 3（第五階段）**：依賴使用者故事 2 完成（db.js 已完整，只加 UI 表現）
- **修飾（第六階段）**：依賴所有使用者故事完成

### 使用者故事內部依賴

```
T008-T009（寫測試）
  → T010-T011（實作 db.js 函式）
    → T012（驗證測試通過）
      → T013-T014（server.js API 端點）[可平行]
        → T017（app.js 渲染）
          → T018（app.js 送出表單）
            → T019（setInterval）
T015-T016（index.html + style.css）[可和 T010-T011 平行]
```

### 平行執行機會

- **第一階段**：T002 與 T003 可平行
- **基礎建設**：T006 與 T007 可平行（T005 完成後）
- **故事 1**：T008 與 T009 可平行；T015 與 T016 可和 T010-T011 平行；T013 與 T014 可平行
- **故事 2**：T024 與 T025 可平行（T023 完成後）
- **修飾**：T032 與 T033 可平行

---

## 平行執行範例：使用者故事 1

```bash
# T008 與 T009 同時進行（均為寫測試，不同函式）：
任務："撰寫 addActivity 的失敗測試（db.test.js）"
任務："撰寫 getAllActivities 的失敗測試（db.test.js）"

# T015 與 T016 可和 T010-T011 同時進行（不同檔案）：
任務："在 index.html 新增活動表單（HTML 結構）"
任務："在 style.css 撰寫基礎樣式"
# 同時：
任務："實作 db.js 的 addActivity 函式"
任務："實作 db.js 的 getAllActivities 函式"

# T013 與 T014 同時進行（同為 server.js 但不同端點）：
# 注意：均在 server.js 中，須確認無衝突（分別實作後合併）
任務："實作 GET /api/activities 端點"
任務："實作 POST /api/activities 端點"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成第一階段：初始化（T001-T003）
2. 完成第二階段：基礎建設（T004-T007）
3. 完成第三階段：使用者故事 1（T008-T019）
4. **停下來驗證**：`node server.js` → 瀏覽器測試新增 + 倒數 + 自動更新
5. MVP 可展示！

### 漸進交付

1. 初始化 + 基礎建設 → 伺服器可啟動
2. 使用者故事 1 → 可新增活動並看到倒數（**MVP**）
3. 使用者故事 2 → 可刪除活動、支援多活動
4. 使用者故事 3 → 到期活動視覺區分
5. 修飾 → 無障礙、測試覆蓋、quickstart 驗證

### 注意事項

- 每個任務完成後標記 `[x]`
- TDD 紅燈檢查點（T008-T009、T020、T026）：執行測試並截圖/記錄失敗狀態後再繼續
- `db.js` 的所有 SQL 查詢必須使用參數化查詢（`prepare().run(params)`），不得字串拼接
- `countdown.db` 不提交至 git（已加入 .gitignore）
- `server.js` 的 500 錯誤不可將 `error.message` 直接回傳給客戶端
