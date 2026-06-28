---
name: flashcard-review
status: open
created: 2026-06-28T08:00:00Z
updated: 2026-06-28T12:00:00Z
progress: 0%
prd: .claude/prds/flashcard-review.md
github: https://github.com/chenghyang2001/french-learning-app/issues/1
---

# Epic: flashcard-review

## Overview

為法語學習 App 加入閃卡複習功能。使用者每次看一張閃卡（正面法文 / 背面中文），按「認識 / 不認識」記錄結果，系統依最小化 SM-2 演算法排程下次複習時間。目標：提高「複習 20 張後已掌握比例」，解決學了就忘的核心痛點。

**最關鍵的架構發現**：`words` 表已有 `srs_interval INTEGER DEFAULT 1` 與 `next_review_at TEXT DEFAULT date('now')` 欄位，`api/words.js` 也已實作 `?due=true` 過濾器。因此本 Epic **不需建新資料表**，只需 4 個新檔案 + 1 個現有路由新增端點。

## Architecture Decisions

### ADR-1：直接使用現有 `words` 表欄位（不建 `flashcard_reviews` 表）

**決策**：複習狀態（interval、next_review_at）直接存在 `words` 表，不新增獨立資料表。

**理由**：

- `db/schema.sql` 已定義 `srs_interval INTEGER NOT NULL DEFAULT 1` 與 `next_review_at TEXT NOT NULL DEFAULT (date('now'))`
- `api/words.js` 已有 `?due=true` → `next_review_at <= date('now')` 過濾邏輯（只待補充 UPDATE 端點）
- 零 schema migration，不影響現有測驗功能
- PRD 要求的「新增 `flashcard_reviews` 資料表」是在**不知道現有 schema 已有 SRS 欄位**的情況下寫的

**取捨**：單表設計在多使用者場景下不可擴展，但 PRD 明確 Out of Scope 帳號系統，KISS 原則優先。

### ADR-2：在現有 `api/words.js` 新增 PATCH 端點（不建獨立路由檔）

**決策**：`PATCH /api/words/:id/review` 加入現有 `api/words.js`，不建 `api/flashcards.js`。

**理由**：更新的是 `words` 資源的欄位，RESTful 語意上屬於 words router；避免新增一個幾乎只有一個端點的路由檔。

### ADR-3：CSS 純 3D 翻轉動畫（不用 JavaScript 控制 animation）

**決策**：閃卡翻轉用 CSS `transform: rotateY(180deg)` + `transition`，JavaScript 只切換 class。

**理由**：零外部依賴，60fps 流暢，符合零 npm 原則。

## Technical Approach

### Frontend Components

| 檔案 | 說明 |
|------|------|
| `public/flashcard.html` | 閃卡頁面：卡片容器 + 翻面按鈕 + 「認識/不認識」按鈕 + 統計摘要區 |
| `public/css/flashcard.css` | 3D 翻轉動畫 + 卡片樣式（正面/背面） |
| `public/js/flashcard.js` | Session 流程：fetch due words → show card → flip → record → next card → show summary |

### Backend Services

| 端點 | 方法 | 說明 |
|------|------|------|
| `GET /api/words?due=true` | 已存在 | 取得今日待複習單字（`next_review_at <= date('now')`） |
| `PATCH /api/words/:id/review` | **新增** | 記錄複習結果，更新 `srs_interval` + `next_review_at` |

**SM-2 邏輯**（在 `/api/words/:id/review` 實作）：

```
認識 (known=true):
  new_interval = min(srs_interval × 2, 30)
  next_review_at = date('now', '+' || new_interval || ' days')

不認識 (known=false):
  new_interval = 1
  next_review_at = date('now', '+1 days')
```

### Infrastructure

- Express static 已服務 `public/` — `flashcard.html` 自動可訪問
- 不需設定新路由（`app.use("/api/words", require("./api/words"))` 已覆蓋新端點）
- 不需 DB migration（schema 已有欄位）

## Implementation Strategy

4 個任務，兩輪平行執行：

**Round 1（可平行）**

- Task 1: 後端 PATCH 端點（SM-2 邏輯）
- Task 2: 前端 HTML/CSS（閃卡 UI + 翻轉動畫）

**Round 2（等 Round 1 完成後平行）**

- Task 3: 前端 JS（Session 流程，依賴 Task 1 的 API + Task 2 的 DOM 結構）
- Task 4: 首頁整合（顯示今日待複習數量，依賴 Task 1 的 API）

## Task Breakdown Preview

| # | 任務 | 平行 | 依賴 | 預估 |
|---|------|------|------|------|
| 001 | 在 `api/words.js` 新增 `PATCH /:id/review`（SM-2 更新邏輯） | ✓ T2 | — | 30m |
| 002 | 建立 `public/flashcard.html` + `public/css/flashcard.css`（CSS 3D 翻轉） | ✓ T1 | — | 45m |
| 003 | 建立 `public/js/flashcard.js`（fetch → 顯示卡片 → 翻面 → 記錄 → 摘要） | — | T1, T2 | 60m |
| 004 | 更新 `public/index.html` 加入「今日待複習 N 張」連結 | — | T1 | 15m |

**總任務數：4（≤10 限制）**

## Dependencies

### 現有可直接使用

- `api/db.js` — `getDb()` 取得 DatabaseSync 實例
- `api/words.js` — 現有 `?due=true` 過濾邏輯（Task 1 直接在此檔新增）
- `db/schema.sql` — `words.srs_interval` + `words.next_review_at` 欄位已存在
- `public/` — Express static 自動服務，無需額外設定

### 外部依賴

- Node.js 22+（`node:sqlite` + CommonJS）
- 瀏覽器原生 `fetch` + CSS 3D transforms（無 npm 套件）

## Success Criteria (Technical)

1. `PATCH /api/words/:id/review` 回傳 `{ id, srs_interval, next_review_at }`，`?known=true` 讓間隔 ×2（上限 30 天），`?known=false` 重置為 1 天
2. `GET /api/words?due=true` 在複習「認識」後隔天不再回傳該單字（間隔重複生效）
3. 閃卡 CSS 翻轉動畫流暢（`transition: transform 0.6s`），正面法文 / 背面中文
4. 複習完所有今日佇列後顯示摘要（認識 N 張 / 不認識 M 張）
5. 首頁顯示今日待複習數量，0 張時顯示「今天的複習已完成！」

## Estimated Effort

| 任務 | 工時 |
|------|------|
| T1 後端 PATCH 端點 | 30 分鐘 |
| T2 HTML/CSS 閃卡 UI | 45 分鐘 |
| T3 JS Session 流程 | 60 分鐘 |
| T4 首頁整合 | 15 分鐘 |
| **合計（平行執行）** | **~105 分鐘牆鐘時間** |

Round 1 平行跑 T1+T2 → 45 分鐘；Round 2 平行跑 T3+T4 → 60 分鐘。

## Tasks Created

| 檔案 | 任務 | 依賴 | 平行 | 大小 |
|------|------|------|------|------|
| [001.md](001.md) | 在 `api/words.js` 新增 `PATCH /:id/review`（SM-2 邏輯） | — | ✓ T2 | S |
| [002.md](002.md) | 建立 `public/flashcard.html` + `public/css/flashcard.css`（CSS 3D 翻轉） | — | ✓ T1 | S |
| [003.md](003.md) | 建立 `public/js/flashcard.js`（Session 流程：fetch → 顯示 → 翻面 → 記錄 → 摘要） | T1, T2 | ✓ T4 | M |
| [004.md](004.md) | 更新 `public/index.html` 加入「今日待複習 N 張」Widget | T1 | ✓ T3 | XS |

**建立時間**：2026-06-28  
**下一步**：`sync the flashcard-review epic to GitHub`（Phase 3 Sync）
