import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "anv-job-"));
  process.env.AUTO_NEWS_VIDEO_ROOT = tmpRoot;
  vi.resetModules();
});

afterEach(() => {
  delete process.env.AUTO_NEWS_VIDEO_ROOT;
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("startJob: concurrency guard", () => {
  it("rejects a second job while one is still running", async () => {
    // Avoid hitting any real network in step 1 by using text source.
    const { startJob, JobBusyError } = await import("./job-runner.js");

    const first = startJob({
      source: { kind: "text", title: "Tin demo 1", content: "x".repeat(300) },
    });
    expect(first.jobId).toMatch(/^job_/);

    expect(() =>
      startJob({
        source: { kind: "text", title: "Tin demo 2", content: "y".repeat(300) },
      }),
    ).toThrow(JobBusyError);
  });
});
