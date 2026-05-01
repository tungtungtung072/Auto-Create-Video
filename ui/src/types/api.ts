export type LlmProvider = "gemini" | "openai" | "anthropic" | "ollama";
export type TtsProvider = "lucylab" | "elevenlabs";
export type JobStatus =
  | "queued"
  | "fetching"
  | "scripting"
  | "review"
  | "tts"
  | "rendering"
  | "done"
  | "error";

export interface CreateJobRequest {
  source:
    | { kind: "url"; url: string }
    | { kind: "text"; title: string; content: string };
  options?: {
    sceneCount?: number;
    targetDurationSec?: number;
    tone?: "energetic" | "formal" | "humorous" | "analytical";
  };
}

export interface Job {
  id: string;
  videoId?: string;
  status: JobStatus;
  currentStep: number;
  totalSteps: number;
  etaSec?: number;
  progress: number;
  error?: string;
  logLines?: string[];
  /** Available when at 'review' step (raw backend script). */
  script?: ScriptDoc;
}

export interface JobEvent {
  type: "progress" | "log" | "step" | "scriptReady" | "done" | "error";
  payload: any;
}

export interface VideoSummary {
  id: string;
  slug: string;
  title: string;
  sourceUrl?: string;
  sourceDomain: string;
  thumbnailUrl: string;
  durationSec: number;
  status: JobStatus;
  createdAt: string;
}

/**
 * Flat scene shape used by the UI. The backend sends both `template`
 * (the discriminator from `templateData.template`) and the full
 * `templateData` object so editors / preview cards can read everything.
 */
export interface ScriptScene {
  id: string;
  voiceText: string;
  template: string;
  templateData?: any;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface ScriptDoc {
  title: string;
  scenes: ScriptScene[];
  /** Full backend script (passed through opaquely for re-render). */
  raw?: any;
}

export interface VideoDetail extends VideoSummary {
  script: ScriptDoc;
  outputDir: string;
  files: { video: string; voice: string; script: string; logFile: string };
  llmProvider: LlmProvider;
  ttsProvider: TtsProvider;
  voiceId: string;
  error?: string;
}

export interface Settings {
  llm: { provider: LlmProvider; apiKey: string };
  tts: { provider: TtsProvider; apiKey: string; voiceId: string };
  branding: { displayName: string; handle: string; followers: string; avatarUrl?: string };
  render: { sfxVolume: number; tiktokCardEnabled: boolean; bgmVolume: number };
  storage: { outputDir: string };
}

export interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
  fix?: string;
}
export interface HealthReport {
  ok: boolean;
  checks: HealthCheck[];
  paths: { rootDir: string };
}
