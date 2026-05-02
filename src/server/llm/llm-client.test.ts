import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.doUnmock("@google/generative-ai");
});

function validScriptJson(): string {
  const scene = (id: string, type: "hook" | "body" | "outro") => ({
    id,
    type,
    voiceText:
      type === "hook"
        ? "Mở đầu hấp dẫn ".repeat(4)
        : type === "outro"
          ? "Cảm ơn bạn đã xem ".repeat(4)
          : "Nội dung body chi tiết ".repeat(4),
    templateData:
      type === "hook"
        ? { template: "hook", headline: "Headline test" }
        : type === "outro"
          ? {
              template: "outro",
              ctaTop: "Đăng ký kênh",
              channelName: "Demo",
              source: "example.com",
            }
          : {
              template: "callout",
              statement: "Tuyên bố quan trọng cho scene body.",
            },
  });
  return JSON.stringify({
    version: "1.0",
    metadata: {
      title: "Tin demo",
      source: { url: "", domain: "local", image: null },
      channel: "Demo",
    },
    voice: { provider: "lucylab", voiceId: "v1", speed: 1.0 },
    scenes: [
      scene("s1", "hook"),
      scene("s2", "body"),
      scene("s3", "body"),
      scene("s4", "body"),
      scene("s5", "outro"),
    ],
  });
}

describe("Gemini withTimeout helper", () => {
  it("clears the timeout when the wrapped promise resolves first (no leaked timer)", async () => {
    vi.useFakeTimers();
    vi.doMock("@google/generative-ai", () => ({
      GoogleGenerativeAI: class {
        constructor(_apiKey: string) {}
        getGenerativeModel() {
          return {
            generateContent: async () => ({
              response: { text: () => validScriptJson() },
            }),
          };
        }
      },
    }));

    const { createLlmClient } = await import("./llm-client.js");
    const client = createLlmClient({ provider: "gemini", apiKey: "x" });
    const result = await client.generateScript(
      {
        title: "Tin demo",
        content: "x",
        url: "",
        domain: "local",
        ogImage: null,
      },
      { channelName: "Demo" },
    );
    expect(result.scenes.length).toBe(5);

    // Track unhandled rejections during timer flush.
    const rejections: unknown[] = [];
    const handler = (e: unknown) => rejections.push(e);
    process.on("unhandledRejection", handler);
    try {
      // Advance past the 90s SCRIPT_GEN_TIMEOUT_MS. If withTimeout failed
      // to clear the timer, the orphaned setTimeout would now reject and
      // surface here.
      await vi.advanceTimersByTimeAsync(120_000);
      await Promise.resolve();
      expect(rejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", handler);
    }
  });
});
