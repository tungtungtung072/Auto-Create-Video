CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  source_kind TEXT NOT NULL,        -- 'url' | 'text'
  source_url TEXT,
  source_domain TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'queued' | 'fetching' | 'scripting' | 'review' | 'tts' | 'rendering' | 'done' | 'error'
  duration_sec REAL,
  output_dir TEXT NOT NULL,
  thumbnail_path TEXT,
  llm_provider TEXT,
  tts_provider TEXT,
  voice_id TEXT,
  script_json TEXT,                 -- last-known script.json (after review)
  error TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  log_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_video_id ON jobs(video_id);
