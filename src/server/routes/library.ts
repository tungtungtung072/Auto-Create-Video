import type { FastifyInstance } from "fastify";
import { existsSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "../db.js";

interface VideoRow {
  id: string;
  slug: string;
  title: string;
  source_kind: string;
  source_url: string | null;
  source_domain: string;
  status: string;
  duration_sec: number | null;
  output_dir: string;
  thumbnail_path: string | null;
  llm_provider: string | null;
  tts_provider: string | null;
  voice_id: string | null;
  script_json: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

/**
 * Flatten the backend script.json into the shape the UI expects:
 * `{ title, scenes: [{ id, voiceText, template, templateData }], raw }`.
 */
function uiScriptFromBackend(raw: unknown): {
  title: string;
  scenes: Array<{ id: string; voiceText: string; template: string; templateData: unknown }>;
  raw: unknown;
} {
  if (!raw || typeof raw !== "object") {
    return { title: "", scenes: [], raw };
  }
  const r = raw as { metadata?: { title?: string }; scenes?: Array<{ id?: string; voiceText?: string; templateData?: { template?: string } }> };
  return {
    title: r.metadata?.title ?? "",
    scenes: (r.scenes ?? []).map((s) => ({
      id: String(s.id ?? ""),
      voiceText: String(s.voiceText ?? ""),
      template: String(s.templateData?.template ?? ""),
      templateData: s.templateData,
    })),
    raw,
  };
}

function rowToSummary(r: VideoRow) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    sourceUrl: r.source_url ?? undefined,
    sourceDomain: r.source_domain,
    thumbnailUrl: r.thumbnail_path ? `/api/library/${r.id}/thumbnail` : "",
    durationSec: r.duration_sec ?? 0,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function libraryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { search?: string; status?: string; sort?: string; page?: string };
  }>("/api/library", async (req) => {
    const db = getDb();
    const search = (req.query.search ?? "").trim();
    const status = (req.query.status ?? "").trim();
    const sort = req.query.sort === "oldest" ? "ASC" : "DESC";

    let where = "1=1";
    const params: unknown[] = [];
    if (search) {
      where += " AND title LIKE ?";
      params.push(`%${search}%`);
    }
    if (status && status !== "all") {
      where += " AND status = ?";
      params.push(status);
    }
    const rows = db
      .prepare(
        `SELECT * FROM videos WHERE ${where} ORDER BY created_at ${sort} LIMIT 100`,
      )
      .all(...params) as VideoRow[];
    return { items: rows.map(rowToSummary), total: rows.length };
  });

  app.get<{ Params: { id: string } }>("/api/library/:id", async (req, reply) => {
    const row = getDb()
      .prepare("SELECT * FROM videos WHERE id = ?")
      .get(req.params.id) as VideoRow | undefined;
    if (!row) {
      reply.code(404);
      return { error: "Không tìm thấy video" };
    }

    const files = {
      video: existsSync(join(row.output_dir, "video.mp4"))
        ? `/api/library/${row.id}/file/video`
        : "",
      voice: existsSync(join(row.output_dir, "voice.mp3"))
        ? `/api/library/${row.id}/file/voice`
        : "",
      script: existsSync(join(row.output_dir, "script.txt"))
        ? `/api/library/${row.id}/file/script-txt`
        : "",
      logFile: "",
    };

    let script: unknown = { title: row.title, scenes: [], raw: null };
    if (row.script_json) {
      try {
        const raw = JSON.parse(row.script_json);
        script = uiScriptFromBackend(raw);
      } catch {
        // ignore — leave default empty script
      }
    }
    return {
      ...rowToSummary(row),
      script,
      outputDir: row.output_dir,
      files,
      llmProvider: row.llm_provider,
      ttsProvider: row.tts_provider,
      voiceId: row.voice_id,
      error: row.error,
    };
  });

  app.delete<{ Params: { id: string } }>("/api/library/:id", async (req, reply) => {
    const row = getDb()
      .prepare("SELECT output_dir FROM videos WHERE id = ?")
      .get(req.params.id) as { output_dir: string } | undefined;
    if (!row) {
      reply.code(404);
      return { error: "Không tìm thấy video" };
    }
    try {
      if (existsSync(row.output_dir)) {
        await rm(row.output_dir, { recursive: true, force: true });
      }
    } catch (e) {
      app.log.warn({ err: e }, "Lỗi khi xoá folder output");
    }
    getDb().prepare("DELETE FROM videos WHERE id = ?").run(req.params.id);
    return { ok: true };
  });

  // File downloads
  app.get<{ Params: { id: string; kind: string } }>(
    "/api/library/:id/file/:kind",
    async (req, reply) => {
      const row = getDb()
        .prepare("SELECT output_dir FROM videos WHERE id = ?")
        .get(req.params.id) as { output_dir: string } | undefined;
      if (!row) {
        reply.code(404);
        return { error: "Không tìm thấy" };
      }
      const map: Record<string, string> = {
        video: "video.mp4",
        voice: "voice.mp3",
        "script-txt": "script.txt",
      };
      const fname = map[req.params.kind];
      if (!fname) {
        reply.code(400);
        return { error: "Loại file không hợp lệ" };
      }
      const fp = join(row.output_dir, fname);
      if (!existsSync(fp)) {
        reply.code(404);
        return { error: "File chưa tồn tại" };
      }
      const { createReadStream } = await import("node:fs");
      reply.header("Content-Length", statSync(fp).size);
      const ct: Record<string, string> = {
        "video.mp4": "video/mp4",
        "voice.mp3": "audio/mpeg",
        "script.txt": "text/plain; charset=utf-8",
      };
      reply.type(ct[fname] ?? "application/octet-stream");
      return reply.send(createReadStream(fp));
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/library/:id/thumbnail",
    async (req, reply) => {
      const row = getDb()
        .prepare("SELECT thumbnail_path FROM videos WHERE id = ?")
        .get(req.params.id) as { thumbnail_path: string | null } | undefined;
      if (!row?.thumbnail_path || !existsSync(row.thumbnail_path)) {
        reply.code(404);
        return { error: "Không có thumbnail" };
      }
      const { createReadStream } = await import("node:fs");
      reply.type("image/jpeg");
      return reply.send(createReadStream(row.thumbnail_path));
    },
  );

  // Stream the video for inline playback
  app.get<{ Params: { id: string } }>("/api/library/:id/stream", async (req, reply) => {
    const row = getDb()
      .prepare("SELECT output_dir FROM videos WHERE id = ?")
      .get(req.params.id) as { output_dir: string } | undefined;
    if (!row) {
      reply.code(404);
      return { error: "Không tìm thấy" };
    }
    const fp = join(row.output_dir, "video.mp4");
    if (!existsSync(fp)) {
      reply.code(404);
      return { error: "Video chưa render" };
    }
    const { createReadStream } = await import("node:fs");
    const size = statSync(fp).size;
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (m) {
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : size - 1;
        reply.code(206);
        reply.header("Content-Range", `bytes ${start}-${end}/${size}`);
        reply.header("Accept-Ranges", "bytes");
        reply.header("Content-Length", end - start + 1);
        reply.type("video/mp4");
        return reply.send(createReadStream(fp, { start, end }));
      }
    }
    reply.header("Content-Length", size);
    reply.type("video/mp4");
    return reply.send(createReadStream(fp));
  });
}
