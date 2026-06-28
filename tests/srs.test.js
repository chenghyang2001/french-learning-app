"use strict";
/**
 * tests/srs.test.js
 *
 * T025：computeNewInterval() 純函式的單元測試
 *
 * TDD 紅色階段：函式尚未 export，所有測試應 FAIL。
 * 實作後（T026）所有測試應 PASS。
 *
 * 技術棧：node:test + node:assert/strict（零額外依賴）
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// computeNewInterval 尚未從 api/quiz.js export，這行會 throw TypeError
// → 所有測試 FAIL，符合 TDD 紅色階段
let computeNewInterval;
try {
  const quiz = require("../api/quiz");
  computeNewInterval = quiz.computeNewInterval;
} catch (_) {
  computeNewInterval = undefined;
}

describe("T025 computeNewInterval 純函式", () => {
  it("T025a: computeNewInterval(1, true) → 2（正確時加倍）", () => {
    assert.ok(
      typeof computeNewInterval === "function",
      "computeNewInterval 未 export 或非函式",
    );
    assert.equal(computeNewInterval(1, true), 2);
  });

  it("T025b: computeNewInterval(15, true) → 30（上限 30 cap）", () => {
    assert.ok(
      typeof computeNewInterval === "function",
      "computeNewInterval 未 export 或非函式",
    );
    assert.equal(computeNewInterval(15, true), 30);
  });

  it("T025c: computeNewInterval(30, true) → 30（已在上限，不超過 30）", () => {
    assert.ok(
      typeof computeNewInterval === "function",
      "computeNewInterval 未 export 或非函式",
    );
    assert.equal(computeNewInterval(30, true), 30);
  });

  it("T025d: computeNewInterval(8, false) → 1（答錯時重置為 1）", () => {
    assert.ok(
      typeof computeNewInterval === "function",
      "computeNewInterval 未 export 或非函式",
    );
    assert.equal(computeNewInterval(8, false), 1);
  });

  it("T025e: computeNewInterval(1, false) → 1（已是最小值，答錯仍為 1）", () => {
    assert.ok(
      typeof computeNewInterval === "function",
      "computeNewInterval 未 export 或非函式",
    );
    assert.equal(computeNewInterval(1, false), 1);
  });
});
