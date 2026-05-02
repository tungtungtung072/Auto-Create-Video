import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Paths used by the local app.
 *
 * - On all platforms the user-visible output folder is `<Desktop>/Auto-news-video/`.
 * - The internal app data (SQLite DB, logs) sits inside the same folder as
 *   `_app/` so the user only has one folder to back up.
 *
 * The Desktop folder is detected per-OS. On Linux without an XDG Desktop dir
 * we fall back to `~/Auto-news-video/` so headless boxes still work.
 */
function detectDesktopDir(): string {
  const home = homedir();
  if (platform() === "darwin" || platform() === "win32") {
    return join(home, "Desktop");
  }
  if (process.env.XDG_DESKTOP_DIR) return process.env.XDG_DESKTOP_DIR;
  return home;
}

export interface AppPaths {
  /** `<Desktop>/Auto-news-video/` */
  rootDir: string;
  /** `<Desktop>/Auto-news-video/videos/` — one folder per video */
  videosDir: string;
  /** `<Desktop>/Auto-news-video/_app/` — DB, logs, settings */
  appDir: string;
  dbPath: string;
  logsDir: string;
}

let cached: AppPaths | null = null;

export function getAppPaths(): AppPaths {
  if (cached) return cached;
  const overrideRoot = process.env.AUTO_NEWS_VIDEO_ROOT;
  const rootDir = overrideRoot && overrideRoot.length > 0
    ? overrideRoot
    : join(detectDesktopDir(), "Auto-news-video");
  const videosDir = join(rootDir, "videos");
  const appDir = join(rootDir, "_app");
  const logsDir = join(appDir, "logs");
  const dbPath = join(appDir, "db.sqlite");

  // Ensure folders exist (idempotent)
  mkdirSync(videosDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  cached = { rootDir, videosDir, appDir, logsDir, dbPath };
  return cached;
}

/** For tests — reset the cached paths so a fresh override env can take effect. */
export function _resetAppPathsForTests(): void {
  cached = null;
}
