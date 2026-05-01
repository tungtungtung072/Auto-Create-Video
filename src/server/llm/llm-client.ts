import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { ScriptSchema, type Script } from "../../render/script-schema.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import type { LlmProvider } from "../settings-store.js";

export interface ArticleInput {
  title: string;
  content: string;
  url: string;
  domain: string;
  ogImage: string | null;
}

export interface GenerateOptions {
  sceneCount?: number;
  targetDurationSec?: number;
  tone?: string;
  channelName: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export interface LlmClient {
  generateScript(article: ArticleInput, options: GenerateOptions): Promise<Script>;
  testKey(): Promise<{ ok: true } | { ok: false; reason: string }>;
}

const SCRIPT_GEN_TIMEOUT_MS = 90000;

export function createLlmClient(cfg: LlmConfig): LlmClient {
  switch (cfg.provider) {
    case "gemini":
      return new GeminiClient(cfg);
    case "openai":
      return new OpenAiClient(cfg);
    case "anthropic":
      return new AnthropicClient(cfg);
    case "ollama":
      return new OllamaClient(cfg);
    default:
      throw new Error(`Unknown LLM provider: ${cfg.provider as string}`);
  }
}

function parseScriptJson(raw: string): Script {
  // Strip ```json ... ``` fences if model added them despite instructions.
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (e) {
    throw new Error(
      `LLM trả về không phải JSON hợp lệ: ${(e as Error).message}\n\n--- raw ---\n${raw.slice(0, 500)}`,
    );
  }
  return ScriptSchema.parse(parsed);
}

// ── Gemini ──────────────────────────────────────────────────────────────

class GeminiClient implements LlmClient {
  constructor(private cfg: LlmConfig) {}

  async generateScript(article: ArticleInput, options: GenerateOptions): Promise<Script> {
    const genAI = new GoogleGenerativeAI(this.cfg.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.cfg.model ?? "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });
    const userPrompt = buildUserPrompt(article, options);
    const res = await Promise.race([
      model.generateContent(userPrompt),
      timeoutReject(SCRIPT_GEN_TIMEOUT_MS),
    ]);
    const text = res.response.text();
    return parseScriptJson(text);
  }

  async testKey(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const genAI = new GoogleGenerativeAI(this.cfg.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.cfg.model ?? "gemini-2.0-flash",
      });
      await model.generateContent("ping");
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }
}

// ── OpenAI ──────────────────────────────────────────────────────────────

class OpenAiClient implements LlmClient {
  constructor(private cfg: LlmConfig) {}

  async generateScript(article: ArticleInput, options: GenerateOptions): Promise<Script> {
    const url = `${this.cfg.endpoint ?? "https://api.openai.com/v1"}/chat/completions`;
    const body = {
      model: this.cfg.model ?? "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(article, options) },
      ],
    };
    const res = await axios.post(url, body, {
      timeout: SCRIPT_GEN_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const txt = res.data?.choices?.[0]?.message?.content;
    if (typeof txt !== "string") {
      throw new Error("OpenAI response thiếu choices[0].message.content");
    }
    return parseScriptJson(txt);
  }

  async testKey(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      await axios.get(`${this.cfg.endpoint ?? "https://api.openai.com/v1"}/models`, {
        headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
        timeout: 10000,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: friendly(e) };
    }
  }
}

// ── Anthropic ───────────────────────────────────────────────────────────

class AnthropicClient implements LlmClient {
  constructor(private cfg: LlmConfig) {}

  async generateScript(article: ArticleInput, options: GenerateOptions): Promise<Script> {
    const url = `${this.cfg.endpoint ?? "https://api.anthropic.com"}/v1/messages`;
    const body = {
      model: this.cfg.model ?? "claude-3-5-haiku-latest",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(article, options) }],
    };
    const res = await axios.post(url, body, {
      timeout: SCRIPT_GEN_TIMEOUT_MS,
      headers: {
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    });
    const txt = res.data?.content?.[0]?.text;
    if (typeof txt !== "string") {
      throw new Error("Anthropic response thiếu content[0].text");
    }
    return parseScriptJson(txt);
  }

  async testKey(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      // Anthropic doesn't have a cheap "/me" endpoint — do a tiny generation.
      await axios.post(
        `${this.cfg.endpoint ?? "https://api.anthropic.com"}/v1/messages`,
        {
          model: this.cfg.model ?? "claude-3-5-haiku-latest",
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        },
        {
          timeout: 15000,
          headers: {
            "x-api-key": this.cfg.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        },
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: friendly(e) };
    }
  }
}

// ── Ollama (local, no key) ──────────────────────────────────────────────

class OllamaClient implements LlmClient {
  constructor(private cfg: LlmConfig) {}

  async generateScript(article: ArticleInput, options: GenerateOptions): Promise<Script> {
    const url = `${this.cfg.endpoint ?? "http://127.0.0.1:11434"}/api/generate`;
    const body = {
      model: this.cfg.model ?? "qwen2.5:7b",
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(article, options),
      format: "json",
      stream: false,
    };
    const res = await axios.post(url, body, { timeout: SCRIPT_GEN_TIMEOUT_MS });
    const txt = res.data?.response;
    if (typeof txt !== "string") {
      throw new Error("Ollama response thiếu response field");
    }
    return parseScriptJson(txt);
  }

  async testKey(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      await axios.get(
        `${this.cfg.endpoint ?? "http://127.0.0.1:11434"}/api/tags`,
        { timeout: 5000 },
      );
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        reason:
          "Không kết nối được tới Ollama tại " +
          (this.cfg.endpoint ?? "http://127.0.0.1:11434") +
          ". Hãy chắc chắn đã chạy `ollama serve` trên máy.",
      };
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`LLM timeout after ${ms}ms`)), ms),
  );
}

function friendly(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 401) return "Sai API key (HTTP 401)";
    if (e.response?.status === 403) return "API key không có quyền (HTTP 403)";
    if (e.response?.status === 429) return "Hết quota / rate limit (HTTP 429)";
    return `Lỗi mạng: ${e.message}`;
  }
  return (e as Error).message;
}
