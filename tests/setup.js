// Vitest global setup — runs before any test file imports services/db.
//
// Makes the test suite hermetic:
// 1. Scrub Turso credentials so tests can never touch the remote database,
//    even when TURSO_* vars are exported in the developer's shell.
// 2. Point better-sqlite3 at a throwaway temp file so tests never mutate
//    the local dev database (fourcast.db).
import os from 'os';
import path from 'path';

delete process.env.TURSO_CONNECTION_URL;
delete process.env.TURSO_AUTH_TOKEN;

process.env.DATABASE_PATH = path.join(
  os.tmpdir(),
  `fourcast-test-${process.pid}-${Date.now()}.db`
);
