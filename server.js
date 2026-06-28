"use strict";
const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/quiz", require("./api/quiz"));
app.use("/api/words", require("./api/words"));

// 未知路由 → 404 JSON（不回 Express 預設 HTML，避免前端誤判為成功）
app.use((req, res) => {
  res.status(404).json({ error: `找不到路由 ${req.method} ${req.path}` });
});

// 全域錯誤中介層（4 個參數，Express 識別為 error handler）
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`French Quiz running at http://localhost:${PORT}`);
});

module.exports = app;
