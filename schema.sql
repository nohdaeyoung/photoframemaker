-- Photo Frame Maker Blog - D1 Schema
-- Run: npx wrangler d1 execute photoframemaker-blog --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  content TEXT DEFAULT '',
  excerpt TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  meta_title TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  og_image TEXT DEFAULT '',
  view_count INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);
