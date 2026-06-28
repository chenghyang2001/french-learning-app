/**
 * app.js — 前端瀏覽器 JS（ESM 模組）
 *
 * 透過 fetch API 與後端 REST API 互動，
 * 使用 DOM API 渲染文章列表與評論，避免 innerHTML 以防 XSS。
 *
 * API 路由：
 *   GET    /api/articles                     — 取得文章清單
 *   GET    /api/articles/:id/comments        — 取得嵌套評論
 *   POST   /api/articles/:id/comments        — 新增評論（body: {content, parent_id?}）
 *   DELETE /api/comments/:id                 — 刪除評論
 */

// ──────────────────────────────────────────────────────
// 全域狀態
// ──────────────────────────────────────────────────────

/** 目前選中的文章 ID，null 表示未選中 */
let currentArticleId = null;

// ──────────────────────────────────────────────────────
// 錯誤訊息工具
// ──────────────────────────────────────────────────────

/**
 * 顯示錯誤訊息到指定的錯誤元素。
 *
 * @param {HTMLElement} element - 錯誤訊息容器（.error-msg 元素）
 * @param {string} message - 要顯示的錯誤文字
 */
function showError(element, message) {
  element.textContent = message;
}

/**
 * 清空指定錯誤元素的訊息。
 *
 * @param {HTMLElement} element - 錯誤訊息容器
 */
function clearError(element) {
  element.textContent = "";
}

// ──────────────────────────────────────────────────────
// 回覆輸入框控制
// ──────────────────────────────────────────────────────

/**
 * 展開指定評論 ID 的回覆輸入框，並讓 textarea 取得焦點。
 *
 * @param {number} commentId - 評論 ID
 */
function showReplyForm(commentId) {
  const commentEl = document.querySelector(`.comment[data-id="${commentId}"]`);
  if (!commentEl) return;
  const replyForm = commentEl.querySelector(".reply-form");
  if (!replyForm) return;
  replyForm.classList.remove("hidden");
  const textarea = replyForm.querySelector(".reply-textarea");
  if (textarea) textarea.focus();
}

/**
 * 隱藏指定評論 ID 的回覆輸入框，清空 textarea 並重置按鈕。
 *
 * @param {number} commentId - 評論 ID
 */
function hideReplyForm(commentId) {
  const commentEl = document.querySelector(`.comment[data-id="${commentId}"]`);
  if (!commentEl) return;
  const replyForm = commentEl.querySelector(".reply-form");
  if (!replyForm) return;
  replyForm.classList.add("hidden");
  const textarea = replyForm.querySelector(".reply-textarea");
  if (textarea) textarea.value = "";
  const submitBtn = replyForm.querySelector(".btn-submit-reply");
  if (submitBtn) submitBtn.disabled = true;
  const errorMsg = replyForm.querySelector(".error-msg");
  if (errorMsg) clearError(errorMsg);
}

// ──────────────────────────────────────────────────────
// API 呼叫
// ──────────────────────────────────────────────────────

/**
 * 新增評論到指定文章。
 *
 * @param {number} articleId - 文章 ID
 * @param {string} content - 評論內容
 * @param {number|null} parentId - 父評論 ID，null 表示頂層評論
 * @returns {Promise<{ok: boolean, comment?: object, error?: string}>}
 */
async function submitComment(articleId, content, parentId) {
  try {
    const body = { content };
    // 只有回覆才傳 parent_id，頂層評論省略（伺服器預設為 null）
    if (parentId !== null) {
      body.parent_id = parentId;
    }
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const comment = await res.json();
      return { ok: true, comment };
    }
    const data = await res.json();
    return { ok: false, error: data.error || "新增失敗，請稍後再試" };
  } catch {
    return { ok: false, error: "網路錯誤，請稍後再試" };
  }
}

/**
 * 刪除指定 ID 的評論（連同所有子回覆）。
 *
 * @param {number} commentId - 評論 ID
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function deleteCommentById(commentId) {
  try {
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) {
      return { ok: true };
    }
    const data = await res.json();
    return { ok: false, error: data.error || "刪除失敗，請稍後再試" };
  } catch {
    return { ok: false, error: "網路錯誤，請稍後再試" };
  }
}

// ──────────────────────────────────────────────────────
// DOM 建立工具
// ──────────────────────────────────────────────────────

/**
 * 建立單則評論的 DOM 元素（含回覆表單與子回覆，僅頂層才有）。
 *
 * @param {object} comment - 評論物件（含 id, content, created_at, replies）
 * @param {boolean} isReply - 是否為回覆層（回覆層不顯示回覆按鈕與回覆輸入框）
 * @returns {HTMLElement}
 */
function createCommentElement(comment, isReply) {
  const container = document.createElement("div");
  container.className = "comment" + (isReply ? " reply" : "");
  container.dataset.id = comment.id;

  // 評論內容（textContent 防 XSS，不用 innerHTML）
  const contentP = document.createElement("p");
  contentP.className = "comment-content";
  contentP.textContent = comment.content;
  container.appendChild(contentP);

  // 評論 meta（時間 + 操作按鈕）
  const metaDiv = document.createElement("div");
  metaDiv.className = "comment-meta";

  const timeSpan = document.createElement("span");
  timeSpan.className = "comment-time";
  timeSpan.textContent = comment.created_at;
  metaDiv.appendChild(timeSpan);

  // 回覆按鈕：只有頂層評論才顯示
  if (!isReply) {
    const replyBtn = document.createElement("button");
    replyBtn.className = "btn-reply";
    replyBtn.type = "button";
    replyBtn.textContent = "回覆";
    metaDiv.appendChild(replyBtn);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-delete";
  deleteBtn.type = "button";
  deleteBtn.textContent = "刪除";
  metaDiv.appendChild(deleteBtn);

  container.appendChild(metaDiv);

  // 回覆輸入框與子回覆列表：只有頂層評論才有
  if (!isReply) {
    // 回覆輸入框（預設 hidden）
    const replyForm = document.createElement("div");
    replyForm.className = "reply-form hidden";

    const replyTextarea = document.createElement("textarea");
    replyTextarea.className = "reply-textarea";
    replyTextarea.placeholder = "輸入回覆...";
    replyTextarea.rows = 3;
    replyForm.appendChild(replyTextarea);

    const replyFormActions = document.createElement("div");
    replyFormActions.className = "reply-form-actions";

    const submitReplyBtn = document.createElement("button");
    submitReplyBtn.className = "btn-submit-reply";
    submitReplyBtn.type = "button";
    submitReplyBtn.disabled = true;
    submitReplyBtn.textContent = "送出回覆";
    replyFormActions.appendChild(submitReplyBtn);

    const cancelReplyBtn = document.createElement("button");
    cancelReplyBtn.className = "btn-cancel-reply";
    cancelReplyBtn.type = "button";
    cancelReplyBtn.textContent = "取消";
    replyFormActions.appendChild(cancelReplyBtn);

    replyForm.appendChild(replyFormActions);

    const replyErrorP = document.createElement("p");
    replyErrorP.className = "error-msg";
    replyForm.appendChild(replyErrorP);

    // textarea 有輸入才啟用送出按鈕
    replyTextarea.addEventListener("input", () => {
      submitReplyBtn.disabled = replyTextarea.value.trim().length === 0;
    });

    container.appendChild(replyForm);

    // 子回覆列表
    const repliesDiv = document.createElement("div");
    repliesDiv.className = "replies";

    // 遞迴渲染子回覆（isReply=true 表示第二層，不再展開回覆輸入框）
    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      for (const reply of comment.replies) {
        repliesDiv.appendChild(createCommentElement(reply, true));
      }
    }

    container.appendChild(repliesDiv);
  }

  return container;
}

// ──────────────────────────────────────────────────────
// 渲染評論
// ──────────────────────────────────────────────────────

/**
 * 把嵌套評論陣列渲染到 #comments-list。
 * 若無評論，顯示空白提示（.empty-state）。
 *
 * @param {Array} comments - 嵌套評論陣列
 */
function renderComments(comments) {
  const commentsList = document.getElementById("comments-list");
  commentsList.replaceChildren();

  if (!comments || comments.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "目前還沒有評論，趕快發表第一則！";
    commentsList.appendChild(emptyState);
    return;
  }

  for (const comment of comments) {
    commentsList.appendChild(createCommentElement(comment, false));
  }
}

/**
 * 從 API 載入指定文章的評論並渲染。
 * 錯誤時只記 console.error，不阻斷畫面。
 *
 * @param {number} articleId - 文章 ID
 */
async function loadComments(articleId) {
  try {
    const res = await fetch(`/api/articles/${articleId}/comments`);
    if (!res.ok) {
      console.error("載入評論失敗，HTTP 狀態：", res.status);
      return;
    }
    const comments = await res.json();
    renderComments(comments);
  } catch (err) {
    console.error("載入評論時發生錯誤：", err);
  }
}

// ──────────────────────────────────────────────────────
// 文章選擇
// ──────────────────────────────────────────────────────

/**
 * 選中一篇文章：更新文章詳情區域、顯示評論區、載入評論。
 *
 * @param {number} id - 文章 ID
 * @param {string} title - 文章標題
 * @param {string} content - 文章內容
 */
function selectArticle(id, title, content) {
  currentArticleId = id;

  // 更新文章詳情（textContent 防 XSS）
  const articleDetail = document.getElementById("article-detail");
  articleDetail.replaceChildren();

  const titleEl = document.createElement("h2");
  titleEl.className = "article-title";
  titleEl.textContent = title;
  articleDetail.appendChild(titleEl);

  const contentEl = document.createElement("div");
  contentEl.className = "article-content";
  contentEl.textContent = content;
  articleDetail.appendChild(contentEl);

  // 顯示評論區（移除 hidden 屬性）
  const commentsSection = document.getElementById("comments-section");
  commentsSection.hidden = false;

  // 重置頂層評論輸入框
  const newComment = document.getElementById("new-comment");
  const submitCommentBtn = document.getElementById("submit-comment");
  const commentError = document.getElementById("comment-error");
  newComment.value = "";
  submitCommentBtn.disabled = true;
  clearError(commentError);

  // 更新側欄選中狀態
  document
    .querySelectorAll(".article-item")
    .forEach((el) => el.classList.remove("active"));
  const activeItem = document.querySelector(`.article-item[data-id="${id}"]`);
  if (activeItem) activeItem.classList.add("active");

  // 載入該文章的評論
  loadComments(id);
}

// ──────────────────────────────────────────────────────
// 文章清單
// ──────────────────────────────────────────────────────

/**
 * 從 API 載入文章清單並渲染到 #article-nav。
 * 每個文章項目點擊後呼叫 selectArticle。
 */
async function loadArticles() {
  const articleNav = document.getElementById("article-nav");
  try {
    const res = await fetch("/api/articles");
    if (!res.ok) {
      console.error("載入文章失敗，HTTP 狀態：", res.status);
      articleNav.replaceChildren();
      const errorP = document.createElement("p");
      errorP.className = "empty-state";
      errorP.textContent = "載入文章失敗，請重新整理頁面";
      articleNav.appendChild(errorP);
      return;
    }

    const articles = await res.json();
    articleNav.replaceChildren();

    if (!articles || articles.length === 0) {
      const emptyP = document.createElement("p");
      emptyP.className = "empty-state";
      emptyP.textContent = "目前沒有文章";
      articleNav.appendChild(emptyP);
      return;
    }

    for (const article of articles) {
      const item = document.createElement("button");
      item.className = "article-item";
      item.dataset.id = article.id;
      item.type = "button";
      item.textContent = article.title;
      // 直接綁定（文章數量有限，不需要 event delegation）
      item.addEventListener("click", () => {
        selectArticle(article.id, article.title, article.content);
      });
      articleNav.appendChild(item);
    }
  } catch (err) {
    console.error("載入文章時發生錯誤：", err);
    articleNav.replaceChildren();
    const errorP = document.createElement("p");
    errorP.className = "empty-state";
    errorP.textContent = "網路錯誤，請稍後再試";
    articleNav.appendChild(errorP);
  }
}

// ──────────────────────────────────────────────────────
// 初始化：事件綁定 + 文章載入
// ──────────────────────────────────────────────────────

/**
 * 頁面初始化：
 * 1. 載入文章清單
 * 2. 綁定頂層評論送出按鈕
 * 3. 在 #comments-list 設定 event delegation（回覆/刪除/送出回覆/取消）
 */
async function init() {
  await loadArticles();

  // ── 頂層評論輸入框：有輸入才啟用送出按鈕 ──
  const newCommentTextarea = document.getElementById("new-comment");
  const submitCommentBtn = document.getElementById("submit-comment");
  const commentErrorEl = document.getElementById("comment-error");

  newCommentTextarea.addEventListener("input", () => {
    submitCommentBtn.disabled = newCommentTextarea.value.trim().length === 0;
  });

  // ── 頂層評論送出 ──
  submitCommentBtn.addEventListener("click", async () => {
    if (!currentArticleId) return;
    const content = newCommentTextarea.value.trim();
    if (!content) return;

    clearError(commentErrorEl);
    submitCommentBtn.disabled = true;

    const result = await submitComment(currentArticleId, content, null);
    if (result.ok) {
      newCommentTextarea.value = "";
      await loadComments(currentArticleId);
    } else {
      showError(commentErrorEl, result.error);
      // 恢復按鈕狀態（輸入框有內容才重新 enable）
      submitCommentBtn.disabled = newCommentTextarea.value.trim().length === 0;
    }
  });

  // ── 評論列表：event delegation 統一處理所有按鈕點擊 ──
  const commentsList = document.getElementById("comments-list");

  commentsList.addEventListener("click", async (e) => {
    // 1. 展開回覆輸入框
    const replyBtn = e.target.closest(".btn-reply");
    if (replyBtn) {
      const commentEl = replyBtn.closest(".comment");
      if (commentEl) {
        showReplyForm(Number(commentEl.dataset.id));
      }
      return;
    }

    // 2. 刪除評論（含子回覆）
    const deleteBtn = e.target.closest(".btn-delete");
    if (deleteBtn) {
      const commentEl = deleteBtn.closest(".comment");
      if (!commentEl) return;
      const commentId = Number(commentEl.dataset.id);

      // 刪除是不可逆操作，請使用者確認
      if (!window.confirm("確定要刪除這則評論？")) return;

      const result = await deleteCommentById(commentId);
      if (result.ok && currentArticleId) {
        await loadComments(currentArticleId);
      } else if (!result.ok) {
        console.error("刪除評論失敗：", result.error);
      }
      return;
    }

    // 3. 送出回覆
    const submitReplyBtn = e.target.closest(".btn-submit-reply");
    if (submitReplyBtn) {
      const replyForm = submitReplyBtn.closest(".reply-form");
      const commentEl = replyForm?.closest(".comment");
      if (!commentEl || !currentArticleId) return;

      const commentId = Number(commentEl.dataset.id);
      const textarea = replyForm.querySelector(".reply-textarea");
      const errorEl = replyForm.querySelector(".error-msg");
      const content = textarea?.value.trim();

      if (!content) return;

      clearError(errorEl);
      submitReplyBtn.disabled = true;

      const result = await submitComment(currentArticleId, content, commentId);
      if (result.ok) {
        hideReplyForm(commentId);
        await loadComments(currentArticleId);
      } else {
        showError(errorEl, result.error);
        // 恢復按鈕狀態
        submitReplyBtn.disabled = (textarea?.value.trim().length ?? 0) === 0;
      }
      return;
    }

    // 4. 取消回覆
    const cancelReplyBtn = e.target.closest(".btn-cancel-reply");
    if (cancelReplyBtn) {
      const replyForm = cancelReplyBtn.closest(".reply-form");
      const commentEl = replyForm?.closest(".comment");
      if (commentEl) {
        hideReplyForm(Number(commentEl.dataset.id));
      }
      return;
    }
  });
}

// ── DOMContentLoaded：頁面載入完成後初始化 ──
document.addEventListener("DOMContentLoaded", () => {
  init();
});
