# API 合約：倒數計時器

**基礎 URL**：`http://localhost:3000`
**傳輸格式**：JSON（`Content-Type: application/json`）
**伺服器**：Node.js `node:http`（無框架）

---

## GET /api/activities

取得所有活動清單，每個活動附帶動態計算的倒數資訊。

**請求**：無請求本文

**回應：200 OK**

```json
[
  {
    "id": 1,
    "name": "生日派對",
    "target_at": "2026-12-31T23:59",
    "created_at": "2026-06-28T10:00",
    "status": "active",
    "countdown": {
      "days": 186,
      "hours": 13,
      "minutes": 59
    }
  },
  {
    "id": 2,
    "name": "舊活動",
    "target_at": "2025-01-01T00:00",
    "created_at": "2024-12-01T09:00",
    "status": "expired",
    "countdown": {
      "days": 0,
      "hours": 0,
      "minutes": 0
    }
  }
]
```

**排序**：依 `target_at` 升冪排列（最快到期的排最前）

---

## POST /api/activities

新增一個活動。

**請求本文**

```json
{
  "name": "生日派對",
  "target_at": "2026-12-31T23:59"
}
```

**欄位驗證**

| 欄位 | 必填 | 規則 |
|------|------|------|
| `name` | ✅ | 非空字串，去除前後空白後長度 > 0 |
| `target_at` | ✅ | ISO 8601 格式 `YYYY-MM-DDTHH:MM` |

**回應：201 Created**

```json
{
  "id": 3,
  "name": "生日派對",
  "target_at": "2026-12-31T23:59",
  "created_at": "2026-06-28T10:05",
  "status": "active",
  "countdown": {
    "days": 186,
    "hours": 13,
    "minutes": 54
  }
}
```

**回應：400 Bad Request**（驗證失敗）

```json
{
  "error": "名稱不可為空白"
}
```

```json
{
  "error": "目標日期格式錯誤，請使用 YYYY-MM-DDTHH:MM"
}
```

---

## DELETE /api/activities/:id

刪除指定 ID 的活動。

**路徑參數**：`id`（整數）

**回應：200 OK**

```json
{
  "deleted": true,
  "id": 3
}
```

**回應：404 Not Found**（ID 不存在）

```json
{
  "error": "活動不存在"
}
```

**回應：400 Bad Request**（ID 非整數）

```json
{
  "error": "無效的活動 ID"
}
```

---

## 靜態資源

| 路徑 | 說明 |
|------|------|
| `GET /` | 回傳 `index.html` |
| `GET /style.css` | 回傳樣式表 |
| `GET /app.js` | 回傳前端 JavaScript |

---

## 錯誤處理原則

- 所有 API 錯誤均回傳 JSON `{ "error": "..." }`（繁體中文錯誤訊息）
- 伺服器端非預期錯誤回傳 `500 Internal Server Error`，訊息為 `{ "error": "伺服器錯誤，請稍後再試" }`（不洩漏內部細節）
- `Content-Type` 回應標頭一律設為 `application/json`
