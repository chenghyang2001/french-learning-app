"use strict";
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "..", "data", "french-quiz.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const SEED_FALLBACK_PATH = path.join(__dirname, "seed-fallback.sql");

try {
  // 若 data/ 目錄不存在則建立，避免 better-sqlite3 開 DB 時找不到父目錄
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  db.exec(fs.readFileSync(SEED_FALLBACK_PATH, "utf8"));
  db.close();

  console.log("Database initialized successfully:", DB_PATH);
} catch (err) {
  console.error("Initialization failed:", err.message);
  process.exit(1);
}
