// Library version of rerender.ts — extracted so the server can call it
// programmatically. The original `rerender.ts` is the CLI wrapper that
// just calls `runRerender(process.argv[2])`.

import { readFile, writeFile, copyFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptSchema } from "./render/script-schema.js";
import { loadConfig } from "./config.js";
import { getDurationSec, concatWithSilence, mixSfxOntoVoice, type SfxMixSpec } from "./assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./assets/sfx-selector.js";
import { existsSync } from "node:fs";
import { composeHtml } from "./render/html-composer.js";
import { renderWithHyperframes } from "./render/hyperframes-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "render", "templates");
const SFX_DIR = join(__dirname, "..", "assets", "sfx");
const SCENE_GAP_SEC = 0.3;

const HYPERFRAMES_CONFIG = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
};

export async function runRerender(outputDir: string): Promise<void> {
  const cfg = loadConfig();
  console.log(`Re-rendering: ${outputDir}`);

  const raw = JSON.parse(await readFile(join(outputDir, "script.json"), "utf8"));
  if (raw.voice?.voiceId === "${VIETNAMESE_VOICEID}" || raw.voice?.voiceId === "${VOICE_ID}") {
    raw.voice.voiceId = cfg.ttsProvider === "lucylab" ? cfg.lucylabVoiceId! : cfg.elevenlabsVoiceId!;
  }
  const script = ScriptSchema.parse(raw);

  const sceneAudio = await Promise.all(
    script.scenes.map(async (s) => {
      const path = join(outputDir, "voice", `scene-${s.id}.mp3`);
      const dur = await getDurationSec(path);
      console.log(`  scene ${s.id}: ${dur.toFixed(2)}s`);
      return { id: s.id, path, durationSec: dur };
    }),
  );

  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }
  const sfxIndex = indexSfxLibrary(SFX_DIR);
  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];
    if (scene.sfx) {
      if (scene.sfx.name === "none") continue;
      const sfxPath = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(sfxPath)) {
        sfxList.push({ path: sfxPath, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
        console.log(`  scene ${scene.id}: SFX override -> ${scene.sfx.name}`);
      }
      continue;
    }
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: scene.templateData.template,
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) continue;
    const sfxPath = join(SFX_DIR, picked.relPath);
    const playback = defaultPlayback(picked);
    sfxList.push({ path: sfxPath, startSec: startSec + playback.offsetSec, volume: playback.volume });
    const why = picked.source === "semantic" ? `semantic "${picked.matchedKeyword}"` : picked.source;
    console.log(`  scene ${scene.id}: SFX -> ${picked.relPath} (${why})`);
  }
  console.log(`mixing ${sfxList.length} SFX into voice.mp3`);
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);

  const totalDur = await getDurationSec(voiceMp3);
  console.log(`voice.mp3 total: ${totalDur.toFixed(2)}s`);

  const bgImagePath = join(outputDir, "images", "bg.jpg");
  const fs = await import("node:fs");
  const bgImageRelPath = fs.existsSync(bgImagePath) ? "images/bg.jpg" : null;

  let bundledAvatar: string | null = null;
  for (const ext of ["jpg", "jpeg", "png", "webp"]) {
    const p = join(__dirname, "..", "assets", `avatar.${ext}`);
    if (existsSync(p)) {
      bundledAvatar = p;
      break;
    }
  }
  if (!bundledAvatar) {
    throw new Error("Không tìm thấy avatar mặc định. Đặt file vào assets/avatar.{jpg,png,webp}");
  }
  const ttAvatarExt = bundledAvatar.split(".").pop()!.toLowerCase();
  const ttAvatarFile = `tiktok-avatar.${ttAvatarExt}`;
  const ttAvatarOut = join(outputDir, ttAvatarFile);
  await copyFile(bundledAvatar, ttAvatarOut);

  const html = composeHtml({
    script,
    sceneAudio: sceneAudio.map((a) => ({ id: a.id, durationSec: a.durationSec })),
    gapSec: SCENE_GAP_SEC,
    bgImageRelPath,
    audioRelPath: "voice.mp3",
    tiktok: cfg.tiktok,
    tiktokAvatarRelPath: ttAvatarFile,
    outroHoldSec: 3,
  });
  await writeFile(join(outputDir, "index.html"), html);
  await writeFile(join(outputDir, "hyperframes.json"), JSON.stringify(HYPERFRAMES_CONFIG, null, 2));
  await writeFile(
    join(outputDir, "meta.json"),
    JSON.stringify({ id: basename(outputDir), name: script.metadata.title, createdAt: new Date().toISOString() }, null, 2),
  );
  await copyFile(join(TPL_DIR, "styles.css"), join(outputDir, "styles.css"));
  await copyFile(join(TPL_DIR, "animations.js"), join(outputDir, "animations.js"));

  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({ compositionDir: outputDir, outputPath: videoPath });
  console.log(`\nDone: ${videoPath}`);
}
