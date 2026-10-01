import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      test TEXT NOT NULL,
      score REAL NOT NULL,
      details TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scores_test_time ON scores(test, created_at);
    CREATE INDEX IF NOT EXISTS scores_player ON scores(player_id, test);
    CREATE TABLE IF NOT EXISTS race_results (
      id INTEGER PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      place INTEGER,            -- NULL = did not finish
      field INTEGER NOT NULL,   -- number of starters
      wpm REAL,
      accuracy REAL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS race_results_player ON race_results(player_id);
  `);
  return db;
}
