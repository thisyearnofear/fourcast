-- Latest signed heartbeat from the autonomous historical lab worker.
CREATE TABLE IF NOT EXISTS historical_lab_status (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
