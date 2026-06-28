/**
 * api.js — 瀏覽器端 fetch wrapper 模組
 *
 * 將所有後端 REST 端點封裝在 window.QuizAPI 全域物件中，
 * 讓 quiz.js 透過語意化函式呼叫後端，而非直接組裝 fetch 選項。
 *
 * 使用方式：
 *   <script src="/js/api.js"></script>
 *   await window.QuizAPI.createSession()
 */
(function () {
  "use strict";

  /**
   * 統一的 HTTP 請求輔助函式。
   *
   * 統一在此處處理 Content-Type header 與非 2xx 錯誤拋出，
   * 避免各端點函式各自實作重複的樣板程式碼。
   *
   * @param {string} method - HTTP 動詞（'GET' / 'POST'）
   * @param {string} path   - 同源相對路徑，例如 '/api/quiz/sessions'
   * @param {object} [body] - 若有則序列化為 JSON 放進 request body
   * @returns {Promise<object>} 解析後的 JSON 回應物件
   * @throws {Error} HTTP 狀態非 2xx 時，或 JSON 解析失敗時
   */
  async function apiFetch(method, path, body) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    // 僅在有 body 時才附加，避免 GET 帶上 null body 觸發部分伺服器警告
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(path, opts);

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("回應解析失敗 (" + res.status + "): " + e.message);
    }

    // 伺服器明確回傳 4xx / 5xx 時，將 error 欄位帶入例外訊息
    if (!res.ok) {
      throw new Error(
        "HTTP " + res.status + ": " + (data.error || res.statusText),
      );
    }

    return data;
  }

  /**
   * QuizAPI — 所有與測驗相關的後端操作。
   *
   * 每個函式回傳 Promise，呼叫端需自行 try/catch 或 .catch() 處理錯誤。
   */
  window.QuizAPI = {
    /**
     * 確認是否可以開始測驗（單字數量是否足夠）。
     *
     * GET /api/quiz/readiness
     * @returns {Promise<{ can_start: boolean, word_count: number, message?: string }>}
     */
    checkReadiness: function () {
      return apiFetch("GET", "/api/quiz/readiness");
    },

    /**
     * 建立新的測驗 session，取得題目清單。
     *
     * POST /api/quiz/sessions
     * @returns {Promise<{
     *   session_id: number,
     *   status: string,
     *   questions: Array<{
     *     question_id: number,
     *     french_word: string,
     *     option_a: string, option_b: string, option_c: string, option_d: string,
     *     correct_answer: string
     *   }>
     * }>}
     */
    createSession: function () {
      return apiFetch("POST", "/api/quiz/sessions");
    },

    /**
     * 取得特定 session 的詳細資料。
     *
     * GET /api/quiz/sessions/:id
     * @param {number} id - session ID
     * @returns {Promise<object>} session 物件
     * @throws {Error} 404 時（session 不存在）
     */
    getSession: function (id) {
      return apiFetch("GET", "/api/quiz/sessions/" + id);
    },

    /**
     * 提交某一題的作答。
     *
     * 伺服器在 session 已完成或 selected_option 不合法時回傳 400；
     * session 不存在時回傳 404；兩者都會在此 throw Error。
     *
     * POST /api/quiz/sessions/:id/answers
     * @param {number} sessionId     - session ID
     * @param {number} questionId    - 題目 ID
     * @param {string} selectedOption - 'a' | 'b' | 'c' | 'd'
     * @returns {Promise<{ is_correct: boolean, correct_option: string }>}
     */
    submitAnswer: function (sessionId, questionId, selectedOption) {
      return apiFetch("POST", "/api/quiz/sessions/" + sessionId + "/answers", {
        question_id: questionId,
        selected_option: selectedOption,
      });
    },

    /**
     * 取得 session 的總成績摘要。
     *
     * GET /api/quiz/sessions/:id/results
     * @param {number} sessionId - session ID
     * @returns {Promise<{
     *   total_questions: number,
     *   correct_count: number,
     *   incorrect_count: number,
     *   percentage: number
     * }>}
     */
    getResults: function (sessionId) {
      return apiFetch("GET", "/api/quiz/sessions/" + sessionId + "/results");
    },

    /**
     * 取得本次測驗答錯的單字清單，供複習使用。
     *
     * GET /api/quiz/sessions/:id/missed
     * @param {number} sessionId - session ID
     * @returns {Promise<{
     *   missed_count: number,
     *   missed_words: Array<{ french: string, correct_answer: string, selected_answer: string }>
     * }>}
     */
    getMissed: function (sessionId) {
      return apiFetch("GET", "/api/quiz/sessions/" + sessionId + "/missed");
    },
  };
})();
