import { create } from "zustand";
import { Settings, Job, VideoSummary } from "@/types/api";

interface AppState {
  /** Current settings (mirror of /api/settings, with masked api keys). */
  settings: Settings;
  setSettings: (s: Settings) => void;
  /** Local optimistic patch — does NOT persist. Call useSettings().save(...) to persist. */
  updateSettings: (patch: Partial<Settings>) => void;

  /** Current in-flight job (or null if idle). */
  currentJob: Job | null;
  setCurrentJob: (job: Job | null) => void;

  /** Library list cache. */
  videos: VideoSummary[];
  setVideos: (v: VideoSummary[]) => void;

  /** Refresh trigger flag (incremented by other hooks to force a re-fetch). */
  libraryRefreshTick: number;
  refreshLibrary: () => void;
}

const defaultSettings: Settings = {
  llm: { provider: "gemini", apiKey: "" },
  tts: { provider: "lucylab", apiKey: "", voiceId: "" },
  branding: { displayName: "Công nghệ 24h", handle: "@congnghe24h", followers: "1.2M followers" },
  render: { sfxVolume: 80, tiktokCardEnabled: true, bgmVolume: 30 },
  storage: { outputDir: "" },
};

export const useAppStore = create<AppState>((set) => ({
  settings: defaultSettings,
  setSettings: (s) => set({ settings: s }),
  updateSettings: (patch) =>
    set((st) => ({
      settings: {
        ...st.settings,
        ...patch,
        llm: { ...st.settings.llm, ...(patch.llm ?? {}) },
        tts: { ...st.settings.tts, ...(patch.tts ?? {}) },
        branding: { ...st.settings.branding, ...(patch.branding ?? {}) },
        render: { ...st.settings.render, ...(patch.render ?? {}) },
        storage: { ...st.settings.storage, ...(patch.storage ?? {}) },
      },
    })),

  currentJob: null,
  setCurrentJob: (job) => set({ currentJob: job }),

  videos: [],
  setVideos: (v) => set({ videos: v }),

  libraryRefreshTick: 0,
  refreshLibrary: () =>
    set((st) => ({ libraryRefreshTick: st.libraryRefreshTick + 1 })),
}));
