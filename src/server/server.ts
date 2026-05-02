/**
 * Local web server for Auto News Video.
 *
 * - Serves the React UI from `ui/dist/` (or proxies to Vite dev when DEV=1).
 * - REST + SSE API at /api/*.
 * - Database + per-video output rooted at <Desktop>/Auto-news-video/.
 *
 * Start: `npm run server`. The first run opens the user's browser
 * automatically.
 */
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import open from "open";
import { jobsRoutes } from "./routes/jobs.js";
import { libraryRoutes } from "./routes/library.js";
import { settingsRoutes } from "./routes/settings.js";
import { healthRoutes } from "./routes/health.js";
import { getDb } from "./db.js";
import { getAppPaths } from "./paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// project root = src/server/.. = src/.. = repo root
const REPO_ROOT = join(__dirname, "..", "..");
const UI_DIST = join(REPO_ROOT, "ui", "dist");

export async function buildServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    bodyLimit: 16 * 1024 * 1024,
    disableRequestLogging: true,
  });

  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyMultipart, { limits: { fileSize: 8 * 1024 * 1024 } });

  await app.register(jobsRoutes);
  await app.register(libraryRoutes);
  await app.register(settingsRoutes);
  await app.register(healthRoutes);

  app.get("/api/ping", async () => ({ ok: true, version: "2.1.0-non-tech" }));

  // Static UI — only if a built ui/dist/ exists.
  if (existsSync(UI_DIST)) {
    await app.register(fastifyStatic, {
      root: UI_DIST,
      prefix: "/",
      wildcard: false,
    });
    // SPA fallback for client-side routes
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        reply.code(404).send({ error: "Endpoint không tồn tại" });
        return;
      }
      reply.sendFile("index.html");
    });
  } else {
    app.get("/", async (_req, reply) => {
      reply.type("text/html");
      return `<!doctype html><html lang="vi"><body style="font-family:system-ui;padding:32px;background:#0B0F1A;color:#F1F5F9">
<h1>🎬 Auto News Video</h1>
<p>Backend server đang chạy nhưng chưa có UI build.</p>
<p>Chạy <code>npm run build:ui</code> rồi <code>npm run server</code> lại.</p>
<p>Hoặc trong development: <code>npm run dev</code> (server + UI hot reload).</p>
</body></html>`;
    });
  }

  return app;
}

export async function startServer() {
  // Touch DB to run migrations early
  getDb();
  const paths = getAppPaths();

  const app = await buildServer();
  const port = parseInt(process.env.PORT ?? "5173", 10);
  const host = process.env.HOST ?? "127.0.0.1";
  await app.listen({ port, host });

  const url = `http://localhost:${port}`;
  app.log.info(`Auto News Video đang chạy tại ${url}`);
  app.log.info(`Thư mục lưu video: ${paths.rootDir}`);

  if (process.env.NO_OPEN !== "1") {
    open(url).catch(() => {
      /* ignore — user can open manually */
    });
  }

  return app;
}

// CLI entry. We compare resolved paths instead of `import.meta.url ===
// \`file://${argv[1]}\`` so this works on Windows, where argv[1] uses
// backslashes while import.meta.url uses POSIX-style file:// URLs.
const isMain = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
  } catch {
    return false;
  }
})();
if (isMain) {
  startServer().catch((e) => {
    console.error("Server failed to start:", e);
    process.exit(1);
  });
}
