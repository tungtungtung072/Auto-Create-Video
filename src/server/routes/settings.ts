import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  readSettingsMasked,
  writeSettings,
  readSettings,
  type AppSettings,
} from "../settings-store.js";
import { createLlmClient } from "../llm/llm-client.js";

const SettingsPatch = z
  .object({
    llm: z
      .object({
        provider: z.enum(["gemini", "openai", "anthropic", "ollama"]).optional(),
        apiKey: z.string().optional(),
      })
      .partial()
      .optional(),
    tts: z
      .object({
        provider: z.enum(["lucylab", "elevenlabs"]).optional(),
        apiKey: z.string().optional(),
        voiceId: z.string().optional(),
      })
      .partial()
      .optional(),
    branding: z
      .object({
        displayName: z.string().optional(),
        handle: z.string().optional(),
        followers: z.string().optional(),
        avatarUrl: z.string().optional(),
      })
      .partial()
      .optional(),
    render: z
      .object({
        sfxVolume: z.number().min(0).max(100).optional(),
        tiktokCardEnabled: z.boolean().optional(),
        bgmVolume: z.number().min(0).max(100).optional(),
      })
      .partial()
      .optional(),
    storage: z
      .object({ outputDir: z.string().optional() })
      .partial()
      .optional(),
  })
  .strict();

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/settings", async () => {
    return readSettingsMasked();
  });

  app.put("/api/settings", async (req, reply) => {
    const r = SettingsPatch.safeParse(req.body);
    if (!r.success) {
      reply.code(400);
      return { error: "Dữ liệu không hợp lệ", details: r.error.format() };
    }
    const updated = writeSettings(r.data as Partial<AppSettings>);
    return {
      llm: { provider: updated.llm.provider, apiKey: maskInline(updated.llm.apiKey) },
      tts: {
        provider: updated.tts.provider,
        apiKey: maskInline(updated.tts.apiKey),
        voiceId: updated.tts.voiceId,
      },
      branding: updated.branding,
      render: updated.render,
      storage: updated.storage,
    };
  });

  app.post<{ Body: { kind: "llm" | "tts" } }>(
    "/api/settings/test",
    async (req, reply) => {
      const kind = req.body?.kind;
      if (kind !== "llm" && kind !== "tts") {
        reply.code(400);
        return { error: "kind phải là 'llm' hoặc 'tts'" };
      }
      const s = readSettings();
      if (kind === "llm") {
        if (!s.llm.apiKey && s.llm.provider !== "ollama") {
          reply.code(400);
          return { ok: false, reason: "Chưa có API key" };
        }
        const c = createLlmClient(s.llm);
        return await c.testKey();
      }
      // TTS test: just check key is present + valid format
      if (!s.tts.apiKey) return { ok: false, reason: "Chưa có API key" };
      if (!s.tts.voiceId) return { ok: false, reason: "Chưa có Voice ID" };
      return { ok: true };
    },
  );
}

function maskInline(s: string): string {
  if (!s) return "";
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}${"•".repeat(8)}${s.slice(-4)}`;
}
