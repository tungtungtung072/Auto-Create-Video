import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  startJob,
  listenToJob,
  approveScript,
  cancelScript,
  startRerenderJob,
  getJob,
  type JobEvent,
} from "../job-runner.js";
import { ScriptSchema } from "../../render/script-schema.js";

const CreateJobBody = z.object({
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.string().url() }),
    z.object({
      kind: z.literal("text"),
      title: z.string().min(1),
      content: z.string().min(50),
    }),
  ]),
  options: z
    .object({
      sceneCount: z.number().int().min(5).max(8).optional(),
      targetDurationSec: z.number().int().min(40).max(80).optional(),
      tone: z.enum(["energetic", "formal", "humorous", "analytical"]).optional(),
    })
    .optional(),
});

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/jobs", async (req, reply) => {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "Yêu cầu không hợp lệ", details: parsed.error.format() };
    }
    const { jobId, videoId } = startJob(parsed.data);
    return { jobId, videoId };
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/stream", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const send = (e: JobEvent) => {
      reply.raw.write(`event: ${e.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(e.payload)}\n\n`);
    };
    const off = listenToJob(req.params.id, send);
    req.raw.on("close", () => {
      off();
      try {
        reply.raw.end();
      } catch {}
    });

    // Heartbeat every 15s so reverse proxies don't kill the connection.
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: keep-alive\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);
    req.raw.on("close", () => clearInterval(heartbeat));
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id", async (req, reply) => {
    const job = getJob(req.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Job không tồn tại" };
    }
    return {
      id: job.id,
      videoId: job.videoId,
      status: job.status,
      currentStep: job.currentStep,
      progress: job.progress,
      script: job.pendingScript ?? null,
    };
  });

  app.post<{ Params: { id: string }; Body: { script?: unknown } }>(
    "/api/jobs/:id/approve",
    async (req, reply) => {
      let script;
      if (req.body && typeof req.body === "object" && "script" in req.body && req.body.script) {
        const r = ScriptSchema.safeParse(req.body.script);
        if (!r.success) {
          reply.code(400);
          return { error: "Kịch bản đã sửa không hợp lệ", details: r.error.format() };
        }
        script = r.data;
      }
      const ok = approveScript(req.params.id, script);
      if (!ok) {
        reply.code(404);
        return { error: "Job không tồn tại hoặc không ở trạng thái review" };
      }
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (req) => {
    const ok = cancelScript(req.params.id);
    return { ok };
  });

  app.post<{ Params: { videoId: string } }>(
    "/api/library/:videoId/rerender",
    async (req, reply) => {
      try {
        const { jobId } = await startRerenderJob(req.params.videoId);
        return { jobId };
      } catch (e) {
        reply.code(400);
        return { error: (e as Error).message };
      }
    },
  );
}
