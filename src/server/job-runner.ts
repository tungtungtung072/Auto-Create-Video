import { EventEmitter } from "node:events";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./db.js";
import { getAppPaths } from "./paths.js";
import { readSettings, applySettingsToEnv } from "./settings-store.js";
import { fetchArticle, safeDomain } from "./article-fetcher.js";
import { createLlmClient } from "./llm/llm-client.js";
import { runPipeline } from "../pipeline.js";
import { ScriptSchema, type Script } from "../render/script-schema.js";
import { toSlug } from "../utils/slug.js";
import { extractThumbnail } from "./thumbnail.js";
import { runRerender } from "../rerender-lib.js";

export type JobStatus =
  | "queued"
  | "fetching"
  | "scripting"
  | "review"
  | "tts"
  | "rendering"
  | "done"
  | "error";

export interface JobEvent {
  type: "progress" | "log" | "step" | "scriptReady" | "done" | "error";
  payload: Record<string, unknown>;
}

export interface CreateJobInput {
  source:
    | { kind: "url"; url: string }
    | { kind: "text"; title: string; content: string };
  options?: {
    sceneCount?: number;
    targetDurationSec?: number;
    tone?: string;
  };
  /** If set, jump straight to TTS+render with the provided script (used by re-render with edits). */
  scriptOverride?: Script;
}

interface ActiveJob {
  id: string;
  videoId: string;
  status: JobStatus;
  currentStep: number;
  progress: number;
  emitter: EventEmitter;
  logPath: string;
  pendingScript?: Script;
  approvalGate?: {
    promise: Promise<{ approved: boolean; script?: Script }>;
    resolve: (v: { approved: boolean; script?: Script }) => void;
  };
}

const TOTAL_STEPS = 8;
const active = new Map<string, ActiveJob>();

function scriptForUi(script: Script) {
  return {
    title: script.metadata.title,
    scenes: script.scenes.map((s) => ({
      id: s.id,
      voiceText: s.voiceText,
      template: s.templateData.template,
      templateData: s.templateData,
    })),
    raw: script,
  };
}

export function getJob(id: string): ActiveJob | undefined {
  return active.get(id);
}

export function listenToJob(id: string, listener: (e: JobEvent) => void): () => void {
  const job = active.get(id);
  if (!job) {
    listener({ type: "error", payload: { message: "Job không tồn tại" } });
    return () => {};
  }
  // Replay current state
  listener({
    type: "progress",
    payload: { status: job.status, currentStep: job.currentStep, progress: job.progress },
  });
  if (job.pendingScript) {
    listener({
      type: "scriptReady",
      payload: { script: scriptForUi(job.pendingScript) },
    });
  }
  const fn = (e: JobEvent) => listener(e);
  job.emitter.on("event", fn);
  return () => job.emitter.off("event", fn);
}

export function approveScript(jobId: string, edited?: Script): boolean {
  const job = active.get(jobId);
  if (!job?.approvalGate) return false;
  job.approvalGate.resolve({ approved: true, script: edited ?? job.pendingScript });
  return true;
}

export function cancelScript(jobId: string): boolean {
  const job = active.get(jobId);
  if (!job?.approvalGate) return false;
  job.approvalGate.resolve({ approved: false });
  return true;
}

export function startJob(input: CreateJobInput, existingVideoId?: string): { jobId: string; videoId: string } {
  const db = getDb();
  const paths = getAppPaths();
  const settings = readSettings();

  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const videoId = existingVideoId ?? `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const initialTitle =
    input.source.kind === "text"
      ? input.source.title
      : `Đang tải ${safeDomain(input.source.url)}...`;
  const slug = toSlug(initialTitle);
  const ts = formatTimestamp(new Date());
  const outputDir = join(paths.videosDir, `${slug}-${ts}`);
  mkdirSync(outputDir, { recursive: true });

  const logPath = join(paths.logsDir, `${id}.log`);
  writeFileSync(logPath, `=== Job ${id} started at ${new Date().toISOString()} ===\n`);

  if (!existingVideoId) {
    db.prepare(
      `INSERT INTO videos (id, slug, title, source_kind, source_url, source_domain, status, output_dir, llm_provider, tts_provider, voice_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      videoId,
      slug,
      initialTitle,
      input.source.kind,
      input.source.kind === "url" ? input.source.url : null,
      input.source.kind === "url" ? safeDomain(input.source.url) : "local",
      "queued",
      outputDir,
      settings.llm.provider,
      settings.tts.provider,
      settings.tts.voiceId || "",
      new Date().toISOString(),
    );
  } else {
    // re-render flow — keep original record but reset status
    db.prepare(
      "UPDATE videos SET status = ?, error = NULL, output_dir = ? WHERE id = ?",
    ).run("queued", outputDir, videoId);
  }

  db.prepare(
    `INSERT INTO jobs (id, video_id, status, current_step, progress, log_path, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, videoId, "queued", 0, 0, logPath, new Date().toISOString());

  const job: ActiveJob = {
    id,
    videoId,
    status: "queued",
    currentStep: 0,
    progress: 0,
    emitter: new EventEmitter(),
    logPath,
  };
  active.set(id, job);

  // fire and forget
  void runJob(job, input, outputDir).catch((e) => {
    writeError(job, e);
  });

  return { jobId: id, videoId };
}

async function runJob(job: ActiveJob, input: CreateJobInput, outputDir: string): Promise<void> {
  const settings = readSettings();
  const log = (line: string) => {
    appendFileSync(job.logPath, `[${new Date().toISOString()}] ${line}\n`);
    job.emitter.emit("event", { type: "log", payload: { line } });
  };
  const setStep = (s: JobStatus, step: number, progress: number) => {
    job.status = s;
    job.currentStep = step;
    job.progress = progress;
    getDb()
      .prepare("UPDATE jobs SET status=?, current_step=?, progress=? WHERE id=?")
      .run(s, step, progress, job.id);
    getDb().prepare("UPDATE videos SET status=? WHERE id=?").run(s, job.videoId);
    job.emitter.emit("event", {
      type: "progress",
      payload: { status: s, currentStep: step, totalSteps: TOTAL_STEPS, progress },
    });
  };

  let script: Script;

  if (input.scriptOverride) {
    log("Re-render mode: dùng kịch bản đã có sẵn, bỏ qua bước fetch + LLM.");
    script = input.scriptOverride;
    setStep("review", 2, 25);
  } else {
    // ── Step 1: Fetch article
    setStep("fetching", 1, 5);
    log(input.source.kind === "url" ? `Đang đọc URL: ${input.source.url}` : "Đang đọc file văn bản...");
    let article: { title: string; content: string; ogImage: string | null; domain: string };
    if (input.source.kind === "url") {
      article = await fetchArticle(input.source.url);
    } else {
      article = {
        title: input.source.title,
        content: input.source.content,
        ogImage: null,
        domain: "local",
      };
    }
    log(`Đã trích xuất ${article.content.length} ký tự nội dung. Tiêu đề: "${article.title}"`);
    // update video title now that we know it
    getDb()
      .prepare("UPDATE videos SET title=?, slug=? WHERE id=?")
      .run(article.title, toSlug(article.title), job.videoId);

    // ── Step 2: LLM scripts
    setStep("scripting", 2, 15);
    if (!settings.llm.apiKey && settings.llm.provider !== "ollama") {
      throw new Error(
        `Chưa cấu hình API key cho ${settings.llm.provider}. Vào Cài đặt → AI viết kịch bản để thêm.`,
      );
    }
    const llm = createLlmClient(settings.llm);
    log(`Đang viết kịch bản bằng ${settings.llm.provider}...`);
    script = await llm.generateScript(
      {
        title: article.title,
        content: article.content,
        url: input.source.kind === "url" ? input.source.url : "",
        domain: article.domain,
        ogImage: article.ogImage,
      },
      {
        sceneCount: input.options?.sceneCount,
        targetDurationSec: input.options?.targetDurationSec,
        tone: input.options?.tone,
        channelName: settings.branding.displayName,
      },
    );
    log(`Đã có kịch bản với ${script.scenes.length} scene.`);

    // ── Wait for user to review (with 30s auto-approve)
    setStep("review", 2, 25);
    job.pendingScript = script;
    job.emitter.emit("event", {
      type: "scriptReady",
      payload: { script: scriptForUi(script) },
    });

    let resolveApproval!: (v: { approved: boolean; script?: Script }) => void;
    const promise = new Promise<{ approved: boolean; script?: Script }>(
      (res) => (resolveApproval = res),
    );
    job.approvalGate = { promise, resolve: resolveApproval };
    const autoTimer = setTimeout(() => resolveApproval({ approved: true, script }), 30000);

    const result = await promise;
    clearTimeout(autoTimer);
    job.approvalGate = undefined;
    if (!result.approved) throw new Error("Người dùng đã hủy job.");
    script = result.script ?? script;
    job.pendingScript = undefined;
  }

  // Persist final script.json into outputDir
  const scriptPath = join(outputDir, "script.json");
  writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  getDb()
    .prepare("UPDATE videos SET script_json=? WHERE id=?")
    .run(JSON.stringify(script), job.videoId);

  // Reflect settings to process.env so loadConfig() picks them up.
  applySettingsToEnv();

  // ── Step 3-7: pipeline (TTS + render)
  setStep("tts", 3, 35);
  // The pipeline will progress through internal steps 3..7. We map them coarsely.
  await runPipelineWithBridge(scriptPath, log, (s, p) => {
    if (s === "rendering") setStep("rendering", 7, p);
    else setStep("tts", s === "tts-mid" ? 4 : 3, p);
  });

  // ── Step 8: thumbnail + finalize
  setStep("rendering", 8, 95);
  const videoPath = join(outputDir, "video.mp4");
  const thumbPath = join(outputDir, "thumbnail.jpg");
  try {
    await extractThumbnail(videoPath, thumbPath);
    log("Đã tạo ảnh thumbnail.");
  } catch (e) {
    log(`Không tạo được thumbnail: ${(e as Error).message}`);
  }

  // duration
  let durationSec: number | null = null;
  try {
    const { getDurationSec } = await import("../assets/audio-tools.js");
    durationSec = await getDurationSec(videoPath);
  } catch {}

  getDb()
    .prepare(
      "UPDATE videos SET status=?, duration_sec=?, thumbnail_path=?, finished_at=? WHERE id=?",
    )
    .run(
      "done",
      durationSec,
      existsSync(thumbPath) ? thumbPath : null,
      new Date().toISOString(),
      job.videoId,
    );
  getDb()
    .prepare("UPDATE jobs SET status=?, finished_at=? WHERE id=?")
    .run("done", new Date().toISOString(), job.id);

  setStep("done", 8, 100);
  job.emitter.emit("event", { type: "done", payload: { videoId: job.videoId } });
}

async function runPipelineWithBridge(
  scriptPath: string,
  log: (line: string) => void,
  onProgress: (
    stage: "tts" | "tts-mid" | "rendering",
    progress: number,
  ) => void,
): Promise<void> {
  // Capture console.log/info/warn/error during runPipeline → forward to log()
  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  const intercept = (lvl: string) => (...args: unknown[]) => {
    const line = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    log(line);
    if (/Step\s*4\//.test(line) || /TTS/i.test(line)) onProgress("tts", 50);
    if (/Step\s*5\//.test(line) || /SFX/.test(line)) onProgress("tts-mid", 60);
    if (/Step\s*6\//.test(line) || /Compose HTML/.test(line)) onProgress("rendering", 70);
    if (/Step\s*7\//.test(line) || /Render with hyperframes/.test(line)) onProgress("rendering", 85);
    orig[lvl as keyof typeof orig].apply(console, args as []);
  };
  console.log = intercept("log");
  console.info = intercept("info");
  console.warn = intercept("warn");
  console.error = intercept("error");
  try {
    await runPipeline(scriptPath);
  } finally {
    console.log = orig.log;
    console.info = orig.info;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

function writeError(job: ActiveJob, e: unknown): void {
  const msg = (e as Error).message || String(e);
  appendFileSync(job.logPath, `[${new Date().toISOString()}] ERROR: ${msg}\n`);
  job.status = "error";
  getDb()
    .prepare("UPDATE jobs SET status=?, error=?, finished_at=? WHERE id=?")
    .run("error", msg, new Date().toISOString(), job.id);
  getDb()
    .prepare("UPDATE videos SET status=?, error=? WHERE id=?")
    .run("error", msg, job.videoId);
  job.emitter.emit("event", { type: "error", payload: { message: msg } });
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

export async function startRerenderJob(videoId: string): Promise<{ jobId: string }> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM videos WHERE id = ?")
    .get(videoId) as { script_json: string | null; output_dir: string } | undefined;
  if (!row) throw new Error("Video không tồn tại");
  if (!row.script_json) throw new Error("Video không có script.json để re-render");
  const script = ScriptSchema.parse(JSON.parse(row.script_json));
  return startRerenderInner(videoId, row.output_dir, script);
}

function startRerenderInner(videoId: string, outputDir: string, script: Script): { jobId: string } {
  const db = getDb();
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const paths = getAppPaths();
  const logPath = join(paths.logsDir, `${id}.log`);
  writeFileSync(logPath, `=== Re-render job ${id} started at ${new Date().toISOString()} ===\n`);

  db.prepare(
    `INSERT INTO jobs (id, video_id, status, current_step, progress, log_path, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, videoId, "queued", 0, 0, logPath, new Date().toISOString());

  const job: ActiveJob = {
    id,
    videoId,
    status: "queued",
    currentStep: 0,
    progress: 0,
    emitter: new EventEmitter(),
    logPath,
  };
  active.set(id, job);

  void (async () => {
    const log = (line: string) => {
      appendFileSync(job.logPath, `[${new Date().toISOString()}] ${line}\n`);
      job.emitter.emit("event", { type: "log", payload: { line } });
    };
    try {
      job.status = "rendering";
      db.prepare("UPDATE videos SET status=? WHERE id=?").run("rendering", videoId);
      job.emitter.emit("event", {
        type: "progress",
        payload: { status: "rendering", currentStep: 7, totalSteps: TOTAL_STEPS, progress: 50 },
      });

      // Write the (possibly edited) script.json before rerender
      const scriptPath = join(outputDir, "script.json");
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));

      applySettingsToEnv();

      // re-render needs a captured stdout too
      const orig = console.log;
      console.log = (...a: unknown[]) => {
        log(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
        orig(...(a as []));
      };
      try {
        await runRerender(outputDir);
      } finally {
        console.log = orig;
      }

      // refresh thumbnail
      const videoPath = join(outputDir, "video.mp4");
      const thumbPath = join(outputDir, "thumbnail.jpg");
      try {
        await extractThumbnail(videoPath, thumbPath);
      } catch {}

      db.prepare(
        "UPDATE videos SET status=?, finished_at=?, error=NULL WHERE id=?",
      ).run("done", new Date().toISOString(), videoId);
      db.prepare("UPDATE jobs SET status=?, finished_at=? WHERE id=?").run(
        "done",
        new Date().toISOString(),
        job.id,
      );
      job.status = "done";
      job.emitter.emit("event", { type: "done", payload: { videoId } });
    } catch (e) {
      writeError(job, e);
    }
  })();

  return { jobId: id };
}


