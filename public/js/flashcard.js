// public/js/flashcard.js — 閃卡複習 Session 流程
// 以 ESM module 方式載入（flashcard.html 使用 type="module"）

const $ = (id) => document.getElementById(id);

let queue = [];
let current = 0;
let knownCount = 0;
let unknownCount = 0;

async function init() {
  try {
    const res = await fetch("/api/words?due=true");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    queue = data.words ?? [];

    if (queue.length === 0) {
      $("progress").textContent = "今天的複習已完成！🎉";
      $("card-container").classList.add("hidden");
      $("controls").classList.add("hidden");
      return;
    }
    showCard(0);
  } catch (err) {
    $("progress").textContent = `載入失敗：${err.message}`;
  }
}

function showCard(index) {
  const word = queue[index];
  $("progress").textContent = `第 ${index + 1} / ${queue.length} 張`;
  $("word-french").textContent = word.french;
  $("word-pos").textContent = word.cefr_level ?? "";
  $("word-english").textContent = word.english;

  // 重置翻轉狀態，讓每張卡從正面開始顯示
  $("card-inner").classList.remove("flipped");
  $("btn-flip").style.display = "";
  $("review-buttons").style.display = "none";
}

$("btn-flip").addEventListener("click", () => {
  $("card-inner").classList.add("flipped");
  $("btn-flip").style.display = "none";
  $("review-buttons").style.display = "flex";
});

async function handleReview(known) {
  const word = queue[current];
  try {
    const res = await fetch(`/api/words/${word.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ known }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // 記錄失敗時顯示錯誤，不繼續前進，避免遺漏複習紀錄
    $("progress").textContent = `記錄失敗：${err.message}`;
    return;
  }

  if (known) knownCount++;
  else unknownCount++;
  current++;

  if (current < queue.length) {
    showCard(current);
  } else {
    showSummary();
  }
}

$("btn-known").addEventListener("click", () => handleReview(true));
$("btn-unknown").addEventListener("click", () => handleReview(false));

function showSummary() {
  $("card-container").classList.add("hidden");
  $("controls").classList.add("hidden");
  // 清空進度文字，避免舊內容殘留在摘要畫面上
  $("progress").textContent = "";
  $("count-known").textContent = knownCount;
  $("count-unknown").textContent = unknownCount;
  $("summary").classList.remove("hidden");
}

init();
