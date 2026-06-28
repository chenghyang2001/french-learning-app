/**
 * app.js — 前端瀏覽器 JS（無 import/export）
 *
 * 透過 fetch API 與後端 REST API 互動，
 * 使用 DOM API 渲染活動卡片，避免 innerHTML 以防 XSS。
 */

/* global document, window, fetch, setInterval */

// ──────────────────────────────────────────────────────
// 渲染活動列表
// ──────────────────────────────────────────────────────

/**
 * 把 API 回傳的活動陣列渲染為卡片，插入 #activity-list。
 *
 * @param {Array} activities - GET /api/activities 的回傳值
 */
function renderActivities(activities) {
  const list = document.getElementById("activity-list");
  const emptyState = document.getElementById("empty-state");

  // 清空現有卡片（replaceChildren 比 innerHTML="" 更安全，不觸發事件洩漏）
  list.replaceChildren();

  if (!activities || activities.length === 0) {
    emptyState.style.display = "";
    return;
  }

  emptyState.style.display = "none";

  activities.forEach((activity) => {
    const card = document.createElement("div");
    card.className =
      "activity-card " + (activity.status === "active" ? "active" : "expired");
    card.dataset.id = activity.id;

    // 活動名稱（textContent 防 XSS）
    const nameEl = document.createElement("p");
    nameEl.className = "card-name";
    nameEl.textContent = activity.name;

    // 目標日期
    const targetEl = document.createElement("p");
    targetEl.className = "card-target";
    targetEl.textContent = "目標：" + activity.target_at;

    // 倒數顯示
    const countdownEl = document.createElement("p");
    countdownEl.className = "card-countdown";
    if (activity.status === "active") {
      const { days, hours, minutes } = activity.countdown;
      countdownEl.textContent =
        days + " 天 " + hours + " 小時 " + minutes + " 分鐘";
    } else {
      countdownEl.textContent = "已到期";
    }

    // 刪除按鈕
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.setAttribute("aria-label", "刪除活動");
    deleteBtn.textContent = "刪除";
    deleteBtn.dataset.id = activity.id;

    card.appendChild(nameEl);
    card.appendChild(targetEl);
    card.appendChild(countdownEl);
    card.appendChild(deleteBtn);
    list.appendChild(card);
  });
}

// ──────────────────────────────────────────────────────
// 從 API 載入活動
// ──────────────────────────────────────────────────────

/**
 * 向後端取得最新活動列表並重新渲染。
 * 錯誤時只記 console.error，不阻斷畫面。
 */
async function loadActivities() {
  try {
    const res = await fetch("/api/activities");
    if (!res.ok) {
      console.error("載入活動失敗，HTTP 狀態：", res.status);
      return;
    }
    const data = await res.json();
    renderActivities(data);
  } catch (err) {
    console.error("載入活動時發生錯誤：", err);
  }
}

// ──────────────────────────────────────────────────────
// 表單送出
// ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("activity-form");
  const formError = document.getElementById("form-error");

  // 表單送出處理
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 清除上次的錯誤訊息
    formError.textContent = "";

    const nameInput = form.elements["name"];
    const targetInput = form.elements["target_at"];

    // 前端驗證：名稱不可為空
    if (!nameInput.value || nameInput.value.trim() === "") {
      formError.textContent = "名稱不可為空白";
      return;
    }

    // 前端驗證：目標日期不可為空
    if (!targetInput.value) {
      formError.textContent = "請選擇目標日期";
      return;
    }

    // 送出期間 disable 按鈕，防止重複點擊送出多筆相同資料
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          target_at: targetInput.value,
        }),
      });

      if (res.ok) {
        form.reset();
        await loadActivities();
      } else {
        // 解析後端回傳的錯誤訊息顯示給使用者
        const data = await res.json();
        formError.textContent = data.error || "新增失敗，請稍後再試";
      }
    } catch (err) {
      console.error("送出表單時發生錯誤：", err);
      formError.textContent = "網路錯誤，請稍後再試";
    } finally {
      // 不論成功或失敗都要恢復按鈕，讓使用者可以重新送出
      submitBtn.disabled = false;
    }
  });

  // ──────────────────────────────────────────────────
  // 事件委派：刪除按鈕（避免對每張卡片綁定監聽器）
  // ──────────────────────────────────────────────────
  const activityList = document.getElementById("activity-list");

  activityList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-delete");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    // 刪除是不可逆操作，先請使用者確認避免誤刪
    if (!window.confirm("確定要刪除此活動？")) return;

    try {
      const res = await fetch("/api/activities/" + id, { method: "DELETE" });
      if (res.ok) {
        await loadActivities();
      } else {
        const data = await res.json();
        console.error("刪除失敗：", data.error);
      }
    } catch (err) {
      console.error("刪除活動時發生錯誤：", err);
    }
  });

  // ──────────────────────────────────────────────────
  // 初始載入 + 每 60 秒自動刷新
  // ──────────────────────────────────────────────────
  loadActivities();
  setInterval(loadActivities, 60000);
});
