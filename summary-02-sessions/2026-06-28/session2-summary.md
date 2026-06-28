# Session 2 Summary — 2026-06-28

## 完成事項

### English Learning App — 前端 JS 三件套（code-writer → code-qa 三輪流程）

- **`public/js/api.js`**（62 行）：fetch 工具函式，`window.fetchWords` / `window.fetchQuiz` / `window.reviewWord` 掛在 `window` 供非 ESM 腳本共用；非 OK response 用 `res.json().then(d => { throw new Error(d.error ?? '伺服器錯誤') })` 拋出語意錯誤。QA 全 PASS（SHA256: f30f2bbf...）
- **`public/js/quiz.js`**（279 行）：英語詞彙測驗 SPA 邏輯，IIFE 包裝（`'use strict'`）；`showView()` 用 `classList.toggle("active", v === target)` 一次切換三個 view；`handleOptionClick` 套用 `.correct` / `.wrong` class，0.8 秒後自動下一題；`isAnswering` flag 防重複點擊。QA 全 PASS（SHA256: 8394c350...）
- **`public/js/flashcard.js`**（185 行）：ESM module，自行封裝 `loadDueWords` / `patchReview`（不依賴 api.js 的 `window.*`）；`handleFlip()` 加 `.flipped` 到 `#card-inner`；SM-2 SRS 邏輯透過 `PATCH /api/words/:id/review` 更新；空列表路徑有專門處理防越界。QA 全 PASS（SHA256: 72e3de50...）

### Git 與 GitHub

- `package.json`（`"type": "module"`, `"engines": {"node": ">=22.5.0"}`）+ `.gitignore`（排除 `words.db`）
- `git init` → 初始 commit（11 個檔案，1801 行） → `gh repo create chenghyang2001/english-learning-app --public` → `git push`
- GitHub repo：<https://github.com/chenghyang2001/english-learning-app>

### VPS 部署

- `/var/www/english-learning-app`（clone from GitHub）
- systemd service：`english-learning-app.service`，`ExecStart=/usr/bin/node --experimental-sqlite server.js`，PORT=3010
- Port 衝突解法：French app 從 port 3010 遷移至 **port 3011**（`french-learning-app.service` 更新）
- Nginx `/english/` → `proxy_pass http://127.0.0.1:3010/`，`/french/` → `proxy_pass http://127.0.0.1:3011/`
- `curl http://127.0.0.1:3010/api/words` 驗證回傳 50 個英文單字（apple, ask, big, book...）

## 關鍵技術筆記

1. **`--experimental-sqlite` flag 必要性**：Node.js v22 的 `node:sqlite` (`DatabaseSync`) 是 experimental API，systemd ExecStart 不加此 flag 會在 `import { DatabaseSync } from 'node:sqlite'` 時失敗；v23+ 才正式穩定。
2. **api.js window.* vs ESM export 取捨**：`quiz.js` 是 IIFE（`<script src>`），`flashcard.js` 是 ESM module（`<script type="module">`）；讓 api.js 掛 window 可避免重複 fetch 邏輯，代價是全域污染（單頁 SPA 可接受）。
3. **Port 衝突處理模式**：新 app 搶先用目標 port，舊 app 順移 +1；兩個 systemd service 獨立管理，互不干擾。
4. **Nginx hookhub 單檔案架構**：VPS 的 `/etc/nginx/sites-enabled/hookhub` 是獨立複本非 symlink，所有 app 的 location 集中在同一個 server block。

## 產出檔案表格

| 檔案 | 位置 | 說明 |
|------|------|------|
| `public/js/api.js` | english-learning-app | fetch 工具函式（window 全域） |
| `public/js/quiz.js` | english-learning-app | 測驗 SPA 邏輯（IIFE） |
| `public/js/flashcard.js` | english-learning-app | 閃卡 SRS（ESM module） |
| `package.json` | english-learning-app | `type:module`, engines node>=22.5 |
| `.gitignore` | english-learning-app | 排除 words.db |
| `/etc/systemd/system/english-learning-app.service` | VPS | port 3010, --experimental-sqlite |
| `/etc/nginx/sites-enabled/hookhub` | VPS | 新增 /english/ location，/french/ 改 3011 |

## HANDOFF（下次 session 優先處理）

### 立即行動

- [ ] 用瀏覽器開啟 `http://187.127.109.145/english/` 實際測試測驗和閃卡功能是否正常（目前只有 curl 驗 API，前端未目視確認）
- [ ] 確認 French Learning App 在 port 3011 功能正常（`http://187.127.109.145/french/`），因 port 遷移後尚未瀏覽器驗證
- [ ] 若需要更多功能，可考慮為 English App 建立更多 CEFR 等級的單字或新增單字管理 API

### 進行中（需接續）

- English Learning App 已完整部署（db.js + server.js + 前端 JS + HTML/CSS），功能架構完成，尚未做前端 E2E 測試（無瀏覽器存取 VPS）

### 注意事項

- `french-learning-app` 的 port 已從 3010 改為 3011，若有任何硬編碼 port 3010 的地方（外部通知、其他 script）需同步更新
- VPS Node.js v22.23.1 已確認支援 `node:sqlite`（需 `--experimental-sqlite` flag）
- `english-learning-app` 的 `words.db` 在 VPS 上每次重啟服務時會重新初始化（如果 DB 不存在的話），種子資料 50 筆會自動插入（`INSERT OR IGNORE`）
