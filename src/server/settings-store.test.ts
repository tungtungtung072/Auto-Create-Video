import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "anv-settings-"));
  process.env.AUTO_NEWS_VIDEO_ROOT = tmpRoot;
  // Reset module cache so getDb() / getAppPaths() pick up our tmp dir.
  vi.resetModules();
});

afterEach(() => {
  delete process.env.AUTO_NEWS_VIDEO_ROOT;
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("writeSettings: masked-key protection", () => {
  it("ignores secret patches that contain bullet (•) characters", async () => {
    const { writeSettings, readSettings } = await import("./settings-store.js");

    // First write: real key persists (unencrypted return value matches input).
    writeSettings({ llm: { provider: "gemini", apiKey: "AIzaSyREAL_KEY_xyz1234" } });
    expect(readSettings().llm.apiKey).toBe("AIzaSyREAL_KEY_xyz1234");

    // Second write: client re-sends the partial mask form `first4••••••••last4`.
    // This must NOT overwrite the real key.
    writeSettings({ llm: { provider: "gemini", apiKey: "AIza••••••••1234" } });
    expect(readSettings().llm.apiKey).toBe("AIzaSyREAL_KEY_xyz1234");

    // Third write: client re-sends pure-bullets form `••••••••`.
    writeSettings({ llm: { provider: "gemini", apiKey: "••••••••" } });
    expect(readSettings().llm.apiKey).toBe("AIzaSyREAL_KEY_xyz1234");

    // Fourth write: empty string (key not changed). No overwrite.
    writeSettings({ llm: { provider: "gemini", apiKey: "" } });
    expect(readSettings().llm.apiKey).toBe("AIzaSyREAL_KEY_xyz1234");

    // Fifth write: a genuinely new key (no bullets) DOES overwrite.
    writeSettings({ llm: { provider: "gemini", apiKey: "AIzaSyNEW_VALUE_5678" } });
    expect(readSettings().llm.apiKey).toBe("AIzaSyNEW_VALUE_5678");
  });

  it("masks api keys when reading via readSettingsMasked", async () => {
    const { writeSettings, readSettingsMasked } = await import("./settings-store.js");
    writeSettings({ llm: { provider: "gemini", apiKey: "AIzaSyREAL_KEY_xyz1234" } });
    const masked = readSettingsMasked().llm.apiKey;
    expect(masked).toContain("•");
    expect(masked).not.toBe("AIzaSyREAL_KEY_xyz1234");
    expect(masked.startsWith("AIza")).toBe(true);
    expect(masked.endsWith("1234")).toBe(true);
  });

  it("encryptString output round-trips via decryptString", async () => {
    const { encryptString, decryptString } = await import("./settings-store.js");
    const original = "AIzaSy_some-key.123";
    const enc = encryptString(original);
    expect(enc).toMatch(/^v1:/);
    expect(enc).not.toContain(original);
    expect(decryptString(enc)).toBe(original);
  });

  it("applySettingsToEnv clears the inactive TTS provider's env vars", async () => {
    const { writeSettings, applySettingsToEnv } = await import("./settings-store.js");

    // Ensure a clean slate so this test doesn't observe leaks from the host
    // shell or earlier tests.
    delete process.env.VIETNAMESE_API_KEY;
    delete process.env.VIETNAMESE_VOICEID;
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;

    // Start on LucyLab — its vars get set, ElevenLabs vars stay clear.
    writeSettings({
      tts: { provider: "lucylab", apiKey: "lucy-key-1", voiceId: "voice-l1" },
    });
    applySettingsToEnv();
    expect(process.env.VIETNAMESE_API_KEY).toBe("lucy-key-1");
    expect(process.env.VIETNAMESE_VOICEID).toBe("voice-l1");
    expect(process.env.ELEVENLABS_API_KEY).toBeUndefined();
    expect(process.env.ELEVENLABS_VOICE_ID).toBeUndefined();

    // Switch to ElevenLabs — old LucyLab vars must be cleared, not lingering.
    writeSettings({
      tts: { provider: "elevenlabs", apiKey: "el-key-2", voiceId: "voice-e2" },
    });
    applySettingsToEnv();
    expect(process.env.ELEVENLABS_API_KEY).toBe("el-key-2");
    expect(process.env.ELEVENLABS_VOICE_ID).toBe("voice-e2");
    expect(process.env.VIETNAMESE_API_KEY).toBeUndefined();
    expect(process.env.VIETNAMESE_VOICEID).toBeUndefined();

    // Switch back to LucyLab with a different key — the ElevenLabs key
    // from the prior iteration must not leak through.
    writeSettings({
      tts: { provider: "lucylab", apiKey: "lucy-key-3", voiceId: "voice-l3" },
    });
    applySettingsToEnv();
    expect(process.env.VIETNAMESE_API_KEY).toBe("lucy-key-3");
    expect(process.env.ELEVENLABS_API_KEY).toBeUndefined();
    expect(process.env.ELEVENLABS_VOICE_ID).toBeUndefined();
  });
});
