"use strict";
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "..", "data", "french-quiz.db");

let _db = null;

function getDb() {
  if (!_db) {
    const fs = require("fs");
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(
        `Database not found at ${DB_PATH}. Run "node db/init.js" first.`,
      );
    }
    _db = new DatabaseSync(DB_PATH);
  }
  return _db;
}

module.exports = getDb;
