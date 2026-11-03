-- Migration 0001: one JSON document per saved workout (kind='workout',
-- id=history id) plus the exercise alias map (kind='aliases', id='main').
-- Bodies are stored whole so nothing is lost; a later exercise-library phase
-- can add normalized tables derived from these rows.
CREATE TABLE IF NOT EXISTS docs (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
);
