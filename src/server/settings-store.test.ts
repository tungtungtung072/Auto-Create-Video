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
});
