import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const sharedDir = process.env.OPENCODE_SHARED_DIR || "/shared/jobs";
const inboxDir = path.join(sharedDir, "inbox");
const outboxDir = path.join(sharedDir, "outbox");
const logsDir = path.join(sharedDir, "logs");
const pollMs = Number(process.env.OPENCODE_JOB_POLL_MS || 5000);
const inFlight = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processFile = async (inputPath) =>
  new Promise((resolve, reject) => {
    const child = spawn("node", ["/workspace/bin/process-job.js", inputPath], {
      cwd: "/workspace",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Job failed with code ${code}`));
        return;
      }

      resolve({
        stdout,
        stderr
      });
    });
  });

await fs.mkdir(inboxDir, { recursive: true });
await fs.mkdir(outboxDir, { recursive: true });
await fs.mkdir(logsDir, { recursive: true });

while (true) {
  try {
    const entries = await fs.readdir(inboxDir);
    const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();

    for (const fileName of jsonFiles) {
      const jobId = path.basename(fileName, ".json");
      const inputPath = path.join(inboxDir, fileName);
      const outputPath = path.join(outboxDir, `${jobId}.result.json`);
      const watchLogPath = path.join(logsDir, `${jobId}.watch.log`);
      const errorPath = path.join(logsDir, `${jobId}.error.log`);

      if (inFlight.has(jobId)) {
        continue;
      }

      try {
        await fs.access(outputPath);
        continue;
      } catch {
        // Result payload not generated yet.
      }

      inFlight.add(jobId);

      processFile(inputPath)
        .then(async ({ stdout, stderr }) => {
          const payload = {
            jobId,
            status: "processed",
            stdout: stdout.trim() || null,
            stderr: stderr.trim() || null,
            processedAt: new Date().toISOString()
          };

          await fs.writeFile(watchLogPath, `${JSON.stringify(payload, null, 2)}\n`);
        })
        .catch(async (error) => {
          const payload = {
            jobId,
            status: "failed",
            error: error.message,
            failedAt: new Date().toISOString()
          };

          await fs.writeFile(errorPath, `${JSON.stringify(payload, null, 2)}\n`);
        })
        .finally(() => {
          inFlight.delete(jobId);
        });
    }
  } catch (error) {
    console.error(`watch-jobs loop failed: ${error.message}`);
  }

  await sleep(pollMs);
}
