/**
 * quiz.js — 法語詞彙測驗前端控制器
 * 管理三個 view（start / quiz / results）的切換、API 呼叫與 UI 狀態更新。
 * 依賴 window.QuizAPI（public/js/api.js 提供）。
 */
(function () {
  "use strict";

  /* ── 測驗狀態 ────────────────────────────────── */
  var sessionId = null;
  var questions = [];
  var currentIndex = 0;

  /* ── 輔助：切換 view（同時只有一個 active）────── */
  function showView(id) {
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
  }

  /* ── checkReadiness：查詞庫狀態，更新 Start view ── */
  async function checkReadiness() {
    var wordCountInfo = document.getElementById("word-count-info");
    var btnStart = document.getElementById("btn-start");
    var startError = document.getElementById("start-error");

    // 重設成待確認狀態
    startError.hidden = true;
    startError.textContent = "";
    btnStart.disabled = true;
    btnStart.setAttribute("aria-disabled", "true");
    btnStart.textContent = "Start Quiz";

    try {
      var result = await window.QuizAPI.checkReadiness();

      if (result.can_start === true) {
        wordCountInfo.textContent =
          "Ready to quiz! (" + result.word_count + " words available)";
        btnStart.disabled = false;
        btnStart.setAttribute("aria-disabled", "false");
      } else {
        // 詞彙不足，顯示差距與提示
        wordCountInfo.textContent =
          result.word_count +
          " / " +
          result.required +
          " words — add more to start";
        startError.textContent = result.message || "Need more words to start.";
        startError.hidden = false;
      }
    } catch (err) {
      startError.textContent = "Failed to check readiness: " + err.message;
      startError.hidden = false;
    }
  }

  /* ── renderQuestion：渲染指定索引的題目 ─────────── */
  function renderQuestion(index) {
    var q = questions[index];
    var progressBar = document.getElementById("progress-bar");
    var questionNum = document.getElementById("question-num");
    var frenchWord = document.getElementById("french-word");
    var quizError = document.getElementById("quiz-error");

    questionNum.textContent =
      "Question " + (index + 1) + " of " + questions.length;
    frenchWord.textContent = q.french_word;

    // 進度條：當前題索引 / 總題數（答題中的進度）
    var pct = (index / questions.length) * 100;
    progressBar.style.width = pct + "%";
    progressBar.setAttribute("aria-valuenow", String(index));

    // 更新四個選項按鈕：填入選項文字並清除上一題的高亮
    ["a", "b", "c", "d"].forEach(function (opt) {
      var btn = document.getElementById("option-" + opt);
      btn.textContent = q["option_" + opt];
      btn.classList.remove("correct", "incorrect");
      btn.disabled = false;
    });

    quizError.hidden = true;
    quizError.textContent = "";
  }

  /* ── fillMissedList：將答錯詞彙填入 missed-list ── */
  function fillMissedList(missedWords) {
    var missedList = document.getElementById("missed-list");
    missedList.innerHTML = "";

    missedWords.forEach(function (item) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="missed-french">' +
        item.french +
        "</span> — " +
        '<span class="missed-correct">' +
        item.correct_answer +
        "</span>" +
        '<br><span class="missed-wrong">You answered: ' +
        (item.selected_answer || "—") +
        "</span>";
      missedList.appendChild(li);
    });

    missedList.hidden = false;
  }

  /* ── showResults：取得結果並切換至 results view ── */
  async function showResults() {
    var progressBar = document.getElementById("progress-bar");
    var scoreDisplay = document.getElementById("score-display");
    var scoreLabel = document.getElementById("score-label");
    var perfectMsg = document.getElementById("perfect-msg");
    var btnAgain = document.getElementById("btn-again");
    var resultsError = document.getElementById("results-error");

    // 進度條推滿，表示測驗完成
    progressBar.style.width = "100%";
    showView("view-results");

    try {
      var results = await window.QuizAPI.getResults(sessionId);
      scoreDisplay.textContent =
        results.correct_count + " / " + results.total_questions;
      scoreLabel.textContent = results.percentage + "% correct";

      if (results.incorrect_count === 0) {
        // 全對：顯示滿分訊息，不顯示錯詞清單
        perfectMsg.hidden = false;
      } else {
        // 有錯：載入並渲染錯詞清單
        var missedData = await window.QuizAPI.getMissed(sessionId);
        fillMissedList(missedData.missed_words);
      }

      btnAgain.textContent = "Play Again";
    } catch (err) {
      resultsError.textContent = "Failed to load results: " + err.message;
      resultsError.hidden = false;
    }
  }

  /* ── DOMContentLoaded：掛載事件監聽並初始化 ───── */
  document.addEventListener("DOMContentLoaded", async function () {
    var btnStart = document.getElementById("btn-start");
    var btnAgain = document.getElementById("btn-again");

    // 初始化：檢查詞庫狀態
    await checkReadiness();

    /* Start Quiz 按鈕 */
    btnStart.addEventListener("click", async function () {
      var startError = document.getElementById("start-error");
      btnStart.disabled = true;
      btnStart.setAttribute("aria-disabled", "true");
      startError.hidden = true;

      try {
        var session = await window.QuizAPI.createSession();
        sessionId = session.session_id;
        questions = session.questions;
        currentIndex = 0;

        renderQuestion(0);
        showView("view-quiz");
      } catch (err) {
        btnStart.disabled = false;
        btnStart.setAttribute("aria-disabled", "false");
        startError.textContent = "Failed to start quiz: " + err.message;
        startError.hidden = false;
      }
    });

    /* Option 按鈕點擊（四個按鈕各自監聽）*/
    document.querySelectorAll(".option-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var selectedOption = this.getAttribute("data-option");
        var q = questions[currentIndex];

        // 禁用全部選項，防止重複提交
        document.querySelectorAll(".option-btn").forEach(function (b) {
          b.disabled = true;
        });

        try {
          var res = await window.QuizAPI.submitAnswer(
            sessionId,
            q.question_id,
            selectedOption,
          );

          // 根據對錯高亮顯示（讓使用者看清楚正確答案）
          if (res.is_correct) {
            document
              .querySelector('[data-option="' + selectedOption + '"]')
              .classList.add("correct");
          } else {
            document
              .querySelector('[data-option="' + selectedOption + '"]')
              .classList.add("incorrect");
            document
              .querySelector('[data-option="' + res.correct_option + '"]')
              .classList.add("correct");
          }

          // 等 1.5 秒讓使用者看清楚結果，再前進
          await new Promise(function (resolve) {
            setTimeout(resolve, 1500);
          });

          currentIndex++;
          if (currentIndex < questions.length) {
            renderQuestion(currentIndex);
          } else {
            await showResults();
          }
        } catch (err) {
          var quizError = document.getElementById("quiz-error");
          quizError.textContent = "Failed to submit answer: " + err.message;
          quizError.hidden = false;

          // 重新啟用按鈕讓使用者可以重試
          document.querySelectorAll(".option-btn").forEach(function (b) {
            b.disabled = false;
          });
        }
      });
    });

    /* Play Again 按鈕 */
    btnAgain.addEventListener("click", async function () {
      var missedList = document.getElementById("missed-list");
      var perfectMsg = document.getElementById("perfect-msg");
      var progressBar = document.getElementById("progress-bar");
      var startError = document.getElementById("start-error");

      // 重設 results view 的動態內容
      missedList.hidden = true;
      missedList.innerHTML = "";
      perfectMsg.hidden = true;
      progressBar.style.width = "0%";
      progressBar.setAttribute("aria-valuenow", "0");
      startError.hidden = true;

      // 重新確認詞庫狀態，更新 Start view
      await checkReadiness();
      showView("view-start");
    });
  });
})();
