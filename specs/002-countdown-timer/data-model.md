# 資料模型：倒數計時器

**功能**：`002-countdown-timer`
**儲存引擎**：SQLite（`node:sqlite`，Node.js 22+ 內建）
**資料庫檔案**：`countdown.db`（位於應用程式根目錄）

---

## 實體：活動（Activity）

### 說明

代表一個使用者想追蹤的未來事件。倒數資訊（天/小時/分鐘）是由 `target_at` 動態計算得出的衍生值，不另行儲存。

### 欄位定義

| 欄位名稱 | 型別 | 約束 | 說明 |
|---------|------|------|------|
| `id` | `INTEGER` | PRIMARY KEY AUTOINCREMENT | 唯一識別碼，由 SQLite 自動產生 |
| `name` | `TEXT` | NOT NULL, 非空白 | 活動名稱（例如「生日派對」），去除前後空白後不可為空 |
| `target_at` | `TEXT` | NOT NULL | 目標日期時間，格式為 ISO 8601（例如 `2026-12-31T23:59`），精度到分鐘 |
| `created_at` | `TEXT` | NOT NULL, DEFAULT now | 建立時間，由伺服器在新增時寫入（ISO 8601 格式） |

### 建立語法

```sql
CREATE TABLE IF NOT EXISTS activities (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL CHECK(length(trim(name)) > 0),
    target_at  TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);
```

### 驗證規則

- `name`：不可為 null、不可為純空白，最大長度建議 100 字元（UI 層驗證）
- `target_at`：必須符合 ISO 8601 `YYYY-MM-DDTHH:MM` 格式；不限制是否為未來時間（允許新增已到期的活動）
- `created_at`：由伺服器端填入，前端不可傳入此欄位

### 狀態轉換

```
新增（target_at 在未來）
    ↓ 隨時間流逝
倒數中（target_at > 現在時間）
    ↓ 目標時間到達
已到期（target_at ≤ 現在時間）
    ↓ 使用者主動操作
已刪除（從資料庫移除，不保留記錄）
```

*注意*：「倒數中」與「已到期」狀態不儲存於資料庫，每次前端呼叫 `GET /api/activities` 時由伺服器動態計算並附加於回應中（`status` 欄位）。

---

## 衍生欄位（API 回應用，不儲存於 DB）

每次查詢活動時，伺服器根據 `target_at` 與當前時間動態計算以下欄位並加入 JSON 回應：

| 欄位名稱 | 型別 | 說明 |
|---------|------|------|
| `status` | `string` | `"active"` 或 `"expired"` |
| `countdown.days` | `integer` | 剩餘天數（若 expired 則為 0） |
| `countdown.hours` | `integer` | 剩餘小時數（0-23，取餘數） |
| `countdown.minutes` | `integer` | 剩餘分鐘數（0-59，取餘數） |

---

## 規模估算

- 單一使用者場景：10-50 個活動
- SQLite 無效能疑慮：`activities` 表在此規模下查詢時間 < 1 毫秒
- 資料表數量：1（符合 constitution Principle V，上限 3 個）
