import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, 'er.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL,          -- fighter | manager | admin
    account_type TEXT,                   -- fighter | management | promotion (original selection)
    team_name    TEXT,
    subdomain    TEXT UNIQUE,
    verified     INTEGER DEFAULT 0,
    verify_token TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS onboarding (
    user_id             TEXT PRIMARY KEY,
    q1_role             TEXT,   -- fighter | management | promotion
    q2_goal             TEXT,   -- track_onboarding | professionalism | sponsor_ready
    q3_common_problem   TEXT,
    q4_end_goal         TEXT,
    q5_upcoming_event   TEXT,   -- yes | no
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

export default db
