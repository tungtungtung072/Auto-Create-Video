import type { FastifyInstance } from "fastify";
import { spawnSync } from "node:child_process";
import { statfsSync } from "node:fs";
import { getAppPaths } from "../paths.js";
import { readSettings } from "../settings-store.js";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
  fix?: string;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    const checks: CheckResult[] = [];

    // Node.js
    const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
    checks.push(
      nodeMajor >= 22
        ? { name: "Node.js", status: "ok", detail: `v${process.versions.node}` }
        : {
            name: "Node.js",
            status: "warn",
            detail: `v${process.versions.node} (cần ≥ 22)`,
            fix: "Cập nhật Node.js lên phiên bản 22 trở lên: https://nodejs.org",
          },
    );

    // FFmpeg
    const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    if (ffmpeg.status === 0) {
      const v = ffmpeg.stdout.split("\n")[0]?.trim() ?? "ffmpeg";
      checks.push({ name: "FFmpeg", status: "ok", detail: v });
    } else {
      checks.push({
        name: "FFmpeg",
        status: "error",
        detail: "Không có ffmpeg trong PATH",
        fix: "Windows: winget install Gyan.FFmpeg | macOS: brew install ffmpeg",
      });
    }

    // ffprobe
    const ffprobe = spawnSync("ffprobe", ["-version"], { encoding: "utf8" });
    checks.push(
      ffprobe.status === 0
        ? { name: "FFprobe", status: "ok", detail: ffprobe.stdout.split("\n")[0]?.trim() ?? "ffprobe" }
        : {
            name: "FFprobe",
            status: "error",
            detail: "Không có ffprobe trong PATH",
            fix: "Cài cùng FFmpeg",
          },
    );

    // Disk space
    try {
      const stat = statfsSync(getAppPaths().rootDir);
      const freeGB = (Number(stat.bavail) * Number(stat.bsize)) / 1024 ** 3;
      checks.push(
        freeGB >= 2
          ? { name: "Dung lượng đĩa", status: "ok", detail: `${freeGB.toFixed(1)} GB còn trống` }
          : {
              name: "Dung lượng đĩa",
              status: "warn",
              detail: `${freeGB.toFixed(1)} GB còn trống (khuyến nghị ≥ 2 GB)`,
              fix: "Xoá các video cũ trong thư viện",
            },
      );
    } catch {
      checks.push({ name: "Dung lượng đĩa", status: "warn", detail: "không kiểm tra được" });
    }

    // Settings completeness
    const s = readSettings();
    if (!s.llm.apiKey && s.llm.provider !== "ollama") {
      checks.push({
        name: "AI viết kịch bản",
        status: "error",
        detail: `Chưa có API key cho ${s.llm.provider}`,
        fix: "Vào Cài đặt → AI viết kịch bản",
      });
    } else {
      checks.push({
        name: "AI viết kịch bản",
        status: "ok",
        detail: `${s.llm.provider} đã cấu hình`,
      });
    }
    if (!s.tts.apiKey || !s.tts.voiceId) {
      checks.push({
        name: "Giọng đọc (TTS)",
        status: "error",
        detail: "Chưa cấu hình API key hoặc Voice ID",
        fix: "Vào Cài đặt → Giọng đọc",
      });
    } else {
      checks.push({
        name: "Giọng đọc (TTS)",
        status: "ok",
        detail: `${s.tts.provider} đã cấu hình`,
      });
    }

    return {
      ok: checks.every((c) => c.status === "ok"),
      checks,
      paths: { rootDir: getAppPaths().rootDir },
    };
  });
}
