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
        logLines: ["Đã đưa vào hàng đợi xử lý..."],
      };
      setCurrentJob(initialJob);
      streamJob(jobId, setCurrentJob, () => refreshLibrary());
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
  setJob: (j: Job | null) => void,
  onDone: () => void,
) {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);
  let job: Job = {
    id: jobId,
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
    update({ logLines: [...(job.logLines ?? []), data.line].slice(-200) });
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
    try {
      const data = JSON.parse((ev as MessageEvent).data ?? "{}");
      update({ status: "error", error: data.message });
      toast({
        title: "Tạo video thất bại",
        description: data.message ?? "Lỗi không xác định",
        variant: "destructive",
      });
    } catch {
      // network-level error events don't have data — let the user retry
    }
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
  }, [refresh]);
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
