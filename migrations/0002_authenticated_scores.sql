-- Preserve historic anonymous rows, but all newly ranked scores require a verified DID.
ALTER TABLE tickets ADD COLUMN account_did TEXT;
ALTER TABLE scores ADD COLUMN did TEXT;
ALTER TABLE scores ADD COLUMN handle TEXT;
ALTER TABLE scores ADD COLUMN display_name TEXT;
ALTER TABLE scores ADD COLUMN avatar TEXT;

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_proofs (
  proof_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_proofs_expiry ON auth_proofs(expires_at);
CREATE INDEX scores_identity ON scores(did, day, ruleset);
