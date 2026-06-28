# 實作計畫：倒數計時器

**分支**：`002-countdown-timer` | **日期**：2026-06-28 | **規格**：[spec.md](spec.md)

**輸入**：功能規格來自 `specs/002-countdown-timer/spec.md`

## 摘要

使用者可以新增包含名稱與目標日期的活動，系統即時顯示距離每個活動還有幾天幾小時幾分鐘。應用程式為本地工具，採用**原生 HTML/CSS/JavaScript** 前端 + **Node.js 22+ 內建模組**後端，以 **SQLite**（`node:sqlite`）進行本地持久化儲存，**零 npm 外部依賴**。

核心功能三層：

1. **P1 — 新增活動並顯示倒數**（MVP）
2. **P2 — 多活動管理與刪除**
3. **P3 — 到期活動標記**

## 技術背景

**語言／版本**：JavaScript（無 TypeScript），Node.js 22.5.0+

**主要依賴套件**：**無**（零 npm 套件，完全使用 Node.js 22+ 內建模組）

- `node:http`（伺服器）
- `node:sqlite`（資料庫）
- `node:fs`、`node:path`、`node:url`（靜態檔案服務）
- `node:test`、`node:assert`（測試）

**儲存方式**：本地 SQLite 資料庫（`countdown.db`），透過 `node:sqlite` 存取

**測試工具**：`node:test`（Node.js 內建），執行：`node --test tests/`

**目標平台**：本機瀏覽器（Chrome/Firefox/Edge，現代版本）+ Node.js 22.5.0+ 本地伺服器

**專案類型**：本地 web 應用程式（local web-app / developer tool）

**效能目標**：API 回應時間 < 100ms（單一使用者，本機 SQLite）；頁面首次載入 < 1 秒

**約束條件**：

- 零 npm 外部依賴（`node_modules` 不存在）
- 不需要網路連線（完全離線運作）
- 無需建置步驟（直接 `node server.js` 啟動）

**規模／範圍**：單一使用者，10–50 個活動，單一 `activities` 資料表

## 準則合規檢查

*閘門：必須在第 0 階段研究前通過。第 1 階段設計後再次確認。*

| 準則 | 狀態 | 說明 |
|------|------|------|
| **I. 學習者優先 UX** | ✅ PASS | 單一主要操作（新增活動）、即時視覺回饋（< 200ms）、表單錯誤訊息友善 |
| **II. 漸進技能架構** | ⚪ N/A | 倒數計時器為工具類功能，不屬於語言學習技能層級 |
| **III. 測試驅動開發** | ✅ PASS | 使用 `node:test`（Node.js 內建）遵循 Red-Green-Refactor；詳見複雜度追蹤 |
| **IV. 資料隱私與完整性** | ✅ PASS | 活動資料（非學習進度）儲存於本機 SQLite；全程參數化查詢（防 SQL injection）；無第三方接收資料 |
| **V. 簡單性與 YAGNI** | ✅ PASS | 零外部依賴、1 個資料表、無抽象層；使用者明確要求最少套件 |
| **VI. 文件語言** | ✅ PASS | 所有規格文件以繁體中文撰寫 |
| **技術堆疊** | ⚠️ 已知偏離 | 詳見「複雜度追蹤」 |

**第 1 階段設計後再次確認**：資料模型單表設計（1 個資料表）符合 Principle V 上限（≤ 3 個），API 合約全程參數化查詢符合 Principle IV。✅

## 專案結構

### 文件（本功能）

```text
specs/002-countdown-timer/
├── plan.md         # 本檔案
├── research.md     # 第 0 階段：技術選型研究
├── data-model.md   # 第 1 階段：SQLite schema 設計
├── quickstart.md   # 第 1 階段：驗證指南
├── contracts/
│   └── api.md      # 第 1 階段：REST API 合約
└── tasks.md        # 第 2 階段（/speckit-tasks 指令產出）
```

### 原始碼（功能根目錄）

```text
countdown-timer/
├── index.html      # 主要 UI（HTML 結構）
├── style.css       # 樣式（原生 CSS，無框架）
├── app.js          # 前端邏輯（原生 JS，fetch + setInterval）
├── server.js       # Node.js HTTP 伺服器 + API 路由
├── db.js           # SQLite 資料存取層（node:sqlite 封裝）
├── countdown.db    # SQLite 資料庫（首次啟動時自動建立，gitignore）
└── tests/
    ├── db.test.js  # DB 層單元測試
    └── api.test.js # API 層整合測試
```

**結構決策**：採用「最小化單一專案」結構——5 個源碼檔案，無子目錄複雜度。前端（3 個靜態檔）由伺服器提供；後端（2 個 JS 檔）提供靜態服務與 REST API。`db.js` 封裝所有 SQLite 操作，`server.js` 只做 HTTP routing，關注點清楚分離。

## 複雜度追蹤

| 偏離項目 | 為何必要 | 拒絕更簡方案的理由 |
|---------|---------|-----------------|
| 前端：原生 HTML/CSS/JS（偏離 Next.js + TypeScript + Tailwind） | 使用者明確要求最少套件；倒數計時器為工具類功能，不屬於 French Learning App 核心學習功能 | Next.js 需要 npm install + 建置步驟，違反零依賴目標；TypeScript 需要編譯工具鏈 |
| 資料庫：本地 SQLite（偏離 Neon PostgreSQL） | 使用者明確要求本地 SQLite；活動資料非學習進度資料，不受 Principle IV 的 PostgreSQL 要求約束 | Neon PostgreSQL 需要網路連線，違反「完全離線」目標 |
| 測試工具：`node:test`（偏離 Vitest + Playwright） | 維持零外部依賴；TDD 原則（Principle III）不變，只是工具不同 | Vitest 需要 npm install；E2E Playwright 對本功能規模而言過度投入 |
