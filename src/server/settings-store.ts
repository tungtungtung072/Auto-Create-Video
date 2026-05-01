import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { getDb } from "./db.js";

/**
 * Light "encryption" for API keys at rest. Keys never leave the user's machine
 * but we still avoid storing them in plain text — anyone with file access to
 * the SQLite DB would otherwise see them in `strings`.
 *
 * The key is derived from the OS user + machine name, so the DB is *not*
 * portable across machines (intentional — share a stolen DB and the keys are
 * unreadable).
 */
function deriveKey(): Buffer {
  const seed = `auto-news-video::${userInfo().username}::${hostname()}`;
  return createHash("sha256").update(seed).digest();
}

const ALGO = "aes-256-gcm";

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptString(blob: string): string {
  if (!blob.startsWith("v1:")) return blob; // legacy/plain
  const [, ivB, tagB, encB] = blob.split(":");
  const decipher = createDecipheriv(ALGO, deriveKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export type LlmProvider = "gemini" | "openai" | "anthropic" | "ollama";
export type TtsProvider = "lucylab" | "elevenlabs";

export interface AppSettings {
  llm: { provider: LlmProvider; apiKey: string };
  tts: { provider: TtsProvider; apiKey: string; voiceId: string };
  branding: {
    displayName: string;
    handle: string;
    followers: string;
    avatarUrl?: string;
  };
  render: {
    sfxVolume: number;
    tiktokCardEnabled: boolean;
    bgmVolume: number;
  };
  storage: { outputDir: string };
}

const DEFAULTS: AppSettings = {
  llm: { provider: "gemini", apiKey: "" },
  tts: { provider: "lucylab", apiKey: "", voiceId: "" },
  branding: {
    displayName: "Công nghệ 24h",
    handle: "@congnghe24h",
    followers: "1.2M followers",
  },
  render: { sfxVolume: 80, tiktokCardEnabled: true, bgmVolume: 30 },
  storage: { outputDir: "" }, // resolved at read time
};

const SECRET_PATHS = ["llm.apiKey", "tts.apiKey"];

function applySecrets(
  raw: Record<string, string>,
  decrypt: boolean,
): AppSettings {
  const out = structuredClone(DEFAULTS);
  for (const [key, val] of Object.entries(raw)) {
    const path = key.split(".");
    let cur: Record<string, unknown> = out as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cur = cur[path[i]] as Record<string, unknown>;
      if (!cur) break;
    }
    if (!cur) continue;
    const last = path[path.length - 1];
    let parsed: unknown;
    try {
      parsed = JSON.parse(val);
    } catch {
      parsed = val;
    }
    if (SECRET_PATHS.includes(key) && decrypt && typeof parsed === "string") {
      try {
        parsed = decryptString(parsed);
      } catch {
        parsed = "";
      }
    }
    cur[last] = parsed;
  }
  return out;
}

export function readSettings(): AppSettings {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  const raw: Record<string, string> = {};
  for (const r of rows) raw[r.key] = r.value;
  return applySecrets(raw, true);
}

/** Same as readSettings but returns API keys masked — safe to send to UI. */
export function readSettingsMasked(): AppSettings {
  const s = readSettings();
  if (s.llm.apiKey) s.llm.apiKey = maskKey(s.llm.apiKey);
  if (s.tts.apiKey) s.tts.apiKey = maskKey(s.tts.apiKey);
  return s;
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
  );
  const now = new Date().toISOString();
  const flat = flatten(patch as Record<string, unknown>, "");
  for (const [key, val] of flat) {
    let serialized: string;
    if (SECRET_PATHS.includes(key) && typeof val === "string" && val.length > 0) {
      // Skip overwrites that look like a mask (UI re-sends ••••)
      if (/^•+$/.test(val)) continue;
      serialized = JSON.stringify(encryptString(val));
    } else {
      serialized = JSON.stringify(val);
    }
    stmt.run(key, serialized, now);
  }
  return readSettings();
}

function flatten(
  obj: Record<string, unknown>,
  prefix: string,
): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v as Record<string, unknown>, key));
    } else if (v !== undefined) {
      out.push([key, v]);
    }
  }
  return out;
}

function maskKey(s: string): string {
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}${"•".repeat(8)}${s.slice(-4)}`;
}

/**
 * Reflect DB-stored settings into process.env so the existing CLI pipeline
 * (`loadConfig()` in src/config.ts) picks them up unchanged.
 */
export function applySettingsToEnv(): AppSettings {
  const s = readSettings();
  process.env.TTS_PROVIDER = s.tts.provider;
  if (s.tts.provider === "lucylab") {
    process.env.VIETNAMESE_API_KEY = s.tts.apiKey;
    process.env.VIETNAMESE_VOICEID = s.tts.voiceId;
  } else {
    process.env.ELEVENLABS_API_KEY = s.tts.apiKey;
    process.env.ELEVENLABS_VOICE_ID = s.tts.voiceId;
  }
  process.env.TIKTOK_DISPLAY_NAME = s.branding.displayName;
  process.env.TIKTOK_HANDLE = s.branding.handle;
  process.env.TIKTOK_FOLLOWERS = s.branding.followers;
  if (s.branding.avatarUrl) {
    process.env.TIKTOK_AVATAR_URL = s.branding.avatarUrl;
  } else {
    delete process.env.TIKTOK_AVATAR_URL;
  }
  return s;
}
