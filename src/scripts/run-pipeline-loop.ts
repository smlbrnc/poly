/**
 * Arbitraj pipeline'ı periyodik çalıştırır.
 * PIPELINE_INTERVAL_SEC (varsayılan 10). Durdurmak için Ctrl+C.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const intervalSec = parseInt(process.env.PIPELINE_INTERVAL_SEC ?? "10", 10);

async function runOnce(): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", "src/scripts/run-pipeline.ts"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, POLYMARKET_ROOT: ROOT },
    });
    child.on("close", (code) => resolve());
  });
}

async function main(): Promise<void> {
  console.log(`Pipeline döngü başladı (aralık: ${intervalSec} sn). Durdurmak için Ctrl+C.`);
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error("Hata:", e);
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch(console.error);
