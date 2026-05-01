import { spawn } from "node:child_process";

/**
 * Extract a single thumbnail JPG from a video using ffmpeg.
 * Captures around 1 second in (so we skip the very first hook flash).
 */
export async function extractThumbnail(
  videoPath: string,
  outPath: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        "1.0",
        "-i",
        videoPath,
        "-vframes",
        "1",
        "-vf",
        "scale=540:-1",
        "-q:v",
        "4",
        outPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr?.on("data", (b) => (stderr += b.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thumbnail exit ${code}: ${stderr.slice(-400)}`));
    });
  });
}
