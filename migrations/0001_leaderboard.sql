CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  seed INTEGER NOT NULL,
  ruleset TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  client_hash TEXT NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tickets_rate ON tickets(client_hash, created_at);
CREATE INDEX IF NOT EXISTS tickets_expiry ON tickets(expires_at);
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  deposited INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_daily ON scores(day, ruleset, score DESC, created_at ASC);
