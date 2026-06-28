# 實作計畫：[功能名稱]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **規格**：[連結]

**輸入**：功能規格來自 `/specs/[###-feature-name]/spec.md`

**說明**：此模板由 `/speckit-plan` 指令填寫。執行流程請參見 `.specify/templates/plan-template.md`。

## 摘要

[從功能規格中擷取：主要需求 + 研究得出的技術方案]

## 技術背景

<!--
  需填寫：將此節內容替換為本專案的技術細節。
  以下結構僅供參考，用於引導迭代過程。
-->

**語言／版本**：[例如 Python 3.11、Node.js 24、Rust 1.75，或 NEEDS CLARIFICATION]

**主要依賴套件**：[例如 FastAPI、Express、LLVM，或 NEEDS CLARIFICATION]

**儲存方式**：[如適用，例如 PostgreSQL、SQLite、檔案，或 N/A]

**測試工具**：[例如 pytest、node:test、cargo test，或 NEEDS CLARIFICATION]

**目標平台**：[例如 Linux 伺服器、iOS 15+、WASM，或 NEEDS CLARIFICATION]

**專案類型**：[例如 library/cli/web-service/mobile-app/compiler/desktop-app，或 NEEDS CLARIFICATION]

**效能目標**：[特定領域，例如 1000 req/s、10k lines/sec、60 fps，或 NEEDS CLARIFICATION]

**約束條件**：[特定領域，例如 p95 < 200ms、記憶體 < 100MB、支援離線，或 NEEDS CLARIFICATION]

**規模／範圍**：[特定領域，例如 1 萬使用者、100 萬行程式碼、50 個畫面，或 NEEDS CLARIFICATION]

## 準則合規檢查

*閘門：必須在第 0 階段研究前通過。第 1 階段設計後再次確認。*

[根據 constitution 文件決定閘門內容]

## 專案結構

### 文件（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本檔案（/speckit-plan 指令輸出）
├── research.md          # 第 0 階段輸出（/speckit-plan 指令）
├── data-model.md        # 第 1 階段輸出（/speckit-plan 指令）
├── quickstart.md        # 第 1 階段輸出（/speckit-plan 指令）
├── contracts/           # 第 1 階段輸出（/speckit-plan 指令）
└── tasks.md             # 第 2 階段輸出（/speckit-tasks 指令，非 /speckit-plan 建立）
```

### 原始碼（Repo 根目錄）
<!--
  需填寫：將下方佔位符目錄樹替換為本功能的實際結構。
  刪除未使用的選項，並以真實路徑（如 apps/admin、packages/something）展開。
  最終交付的計畫不得包含選項標籤。
-->

```text
# [若未使用請移除] 選項 1：單一專案（預設）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [若未使用請移除] 選項 2：Web 應用程式（偵測到 frontend + backend 時）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [若未使用請移除] 選項 3：Mobile + API（偵測到 iOS/Android 時）
api/
└── [同上方 backend]

ios/ 或 android/
└── [平台特定結構：功能模組、UI 流程、平台測試]
```

**結構決策**：[說明所選結構，並引用上方擷取的實際目錄]

## 複雜度追蹤

> **僅在準則合規檢查有需要說明的違例時填寫**

| 違例 | 為何必要 | 拒絕更簡方案的理由 |
|------|----------|-------------------|
| [例如第 4 個資料表] | [當前需求] | [為何 3 個資料表不夠用] |
| [例如 Repository 模式] | [具體問題] | [為何直接存取 DB 不夠用] |
