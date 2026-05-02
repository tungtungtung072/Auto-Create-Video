import { useState, useEffect, useCallback } from "react";
import {
  Job,
  CreateJobRequest,
  VideoSummary,
  VideoDetail,
  Settings,
  HealthReport,
  ScriptDoc,
} from "@/types/api";
import { useAppStore } from "@/stores/appStore";
import { toast } from "@/components/ui/use-toast";

const API_BASE = ""; // same origin; vite dev server proxies /api → backend

async function http<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error ?? JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Create job + SSE ────────────────────────────────────────────────────

export function useCreateJob() {
  const { setCurrentJob, refreshLibrary } = useAppStore();
  const [isPending, setIsPending] = useState(false);

  const mutate = async (req: CreateJobRequest) => {
    setIsPending(true);
    try {
      const { jobId, videoId } = await http<{ jobId: string; videoId: string }>(
        "/api/jobs",
        { method: "POST", json: req },
      );
      const initialJob: Job = {
        id: jobId,
        videoId,
        status: "queued",
        currentStep: 0,
        totalSteps: 8,
        progress: 0,
        logLines: [
          { ts: new Date().toISOString(), text: "Đã đưa vào hàng đợi xử lý..." },
        ],
      };
      setCurrentJob(initialJob);
      streamJob(jobId, videoId, setCurrentJob, () => refreshLibrary());
    } catch (e) {
      toast({
        title: "Không tạo được job",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending };
}

function streamJob(
  jobId: string,
  videoId: string,
  setJob: (j: Job | null) => void,
  onDone: () => void,
) {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);
  // Seed with videoId so the store keeps it across SSE patches — the first
  // `progress` event would otherwise replace the store's job (which had it)
  // with one missing it, until the final `done` event puts it back.
  let job: Job = {
    id: jobId,
    videoId,
    status: "queued",
    currentStep: 0,
    totalSteps: 8,
    progress: 0,
    logLines: [],
  };

  const update = (patch: Partial<Job>) => {
    job = { ...job, ...patch };
    setJob(job);
  };

  es.addEventListener("progress", (ev) => {
    const data = JSON.parse((ev as MessageEvent).data);
    update({
      status: data.status,
      currentStep: data.currentStep,
      progress: data.progress,
      totalSteps: data.totalSteps ?? 8,
    });
  });

  es.addEventListener("log", (ev) => {
    const data = JSON.parse((ev as MessageEvent).data);
    // Capture the timestamp when the line arrives so the UI can show a
    // meaningful per-line time. Using new Date() at render time would give
    // every visible row the same timestamp.
    const entry = { ts: new Date().toISOString(), text: String(data.line) };
    update({ logLines: [...(job.logLines ?? []), entry].slice(-200) });
  });

  es.addEventListener("scriptReady", (ev) => {
    const data = JSON.parse((ev as MessageEvent).data);
    update({ script: data.script as ScriptDoc, status: "review" });
  });

  es.addEventListener("done", (ev) => {
    const data = JSON.parse((ev as MessageEvent).data);
    update({ status: "done", progress: 100, videoId: data.videoId });
    toast({ title: "Hoàn tất!", description: "Video đã sẵn sàng trong thư viện." });
    onDone();
    es.close();
  });

  es.addEventListener("error", (ev) => {
    // Two distinct cases share this listener:
    //   1. Server-emitted named `error` event — a MessageEvent with JSON .data.
    //      The job has actually failed; show toast and close the stream.
    //   2. Network-level error — a plain Event with no `.data` property.
    //      EventSource auto-reconnects; do nothing so we don't show a false
    //      "job failed" toast for a transient blip.
    const raw = (ev as MessageEvent).data;
    if (raw == null || typeof raw !== "string") return;
    let data: { message?: string } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return; // malformed payload — ignore
    }
    update({ status: "error", error: data.message });
    toast({
      title: "Tạo video thất bại",
      description: data.message ?? "Lỗi không xác định",
      variant: "destructive",
    });
    es.close();
  });

  // Keep ref so caller could close it
  (window as unknown as { __activeEs?: EventSource }).__activeEs?.close();
  (window as unknown as { __activeEs?: EventSource }).__activeEs = es;
}

export function useApproveScript() {
  return useCallback(async (jobId: string, edited?: ScriptDoc) => {
    const body: { script?: unknown } = {};
    if (edited) {
      // Send the raw backend script back if we have it; otherwise reconstruct
      // by patching voiceText into the original raw script.
      body.script = (edited as { raw?: unknown }).raw ?? null;
    }
    await http(`/api/jobs/${jobId}/approve`, { method: "POST", json: body });
  }, []);
}

export function useCancelJob() {
  return useCallback(async (jobId: string) => {
    await http(`/api/jobs/${jobId}/cancel`, { method: "POST" });
  }, []);
}

// ── Library ─────────────────────────────────────────────────────────────

export function useLibrary() {
  const { videos, setVideos } = useAppStore();
  // Subscribe to the refresh tick so a `refreshLibrary()` call elsewhere
  // (e.g. on job completion) triggers a re-fetch here.
  const libraryRefreshTick = useAppStore((s) => s.libraryRefreshTick);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(
    async (params?: { search?: string; status?: string; sort?: string }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (params?.search) qs.set("search", params.search);
        if (params?.status) qs.set("status", params.status);
        if (params?.sort) qs.set("sort", params.sort);
        const res = await http<{ items: VideoSummary[] }>(
          `/api/library?${qs.toString()}`,
        );
        setVideos(res.items);
      } finally {
        setLoading(false);
      }
    },
    [setVideos],
  );
  useEffect(() => {
    refresh();
  }, [refresh, libraryRefreshTick]);
  return { videos, loading, refresh };
}

export function useVideoDetail(id: string | undefined) {
  const [data, setData] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const v = await http<VideoDetail>(`/api/library/${id}`);
      setData(v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, error, reload };
}

export async function deleteVideo(id: string): Promise<void> {
  await http(`/api/library/${id}`, { method: "DELETE" });
}

export async function rerenderVideo(id: string): Promise<{ jobId: string }> {
  return await http(`/api/library/${id}/rerender`, { method: "POST" });
}

// ── Settings ────────────────────────────────────────────────────────────

export function useSettings() {
  const { settings, setSettings } = useAppStore();
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await http<Settings>("/api/settings");
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }, [setSettings]);
  const save = useCallback(
    async (patch: Partial<Settings>) => {
      const s = await http<Settings>("/api/settings", { method: "PUT", json: patch });
      setSettings(s);
      return s;
    },
    [setSettings],
  );
  const test = useCallback(async (kind: "llm" | "tts") => {
    return await http<{ ok: boolean; reason?: string }>("/api/settings/test", {
      method: "POST",
      json: { kind },
    });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { settings, loading, refresh, save, test };
}

// ── Health ──────────────────────────────────────────────────────────────

export function useHealth() {
  const [data, setData] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const h = await http<HealthReport>("/api/health");
      setData(h);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, loading, refresh };
}
