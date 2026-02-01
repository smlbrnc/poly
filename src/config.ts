/**
 * Config ve .env yükleme; Vercel'de process.env öncelikli.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename, join, resolve } from "path";
import yaml from "js-yaml";
import dotenv from "dotenv";

const ROOT = process.cwd();
const CONFIG_DIR = join(ROOT, "config");
const IS_VERCEL = process.env.VERCEL === "1";

/** Ana proje (polymarket/) data dizini — kurallara uyum: kuyruk vb. ana dizindeki data/ kullanılır. */
export function getDataRoot(): string {
  const env = loadEnv();
  const rel = env.POLYMARKET_ROOT?.trim();
  if (rel) return resolve(ROOT, rel);
  if (basename(ROOT) === "polymarket-arbitrage-node") return resolve(ROOT, "..");
  return ROOT;
}

const envPath = join(ROOT, ".env");
const parentEnvPath = join(ROOT, "..", ".env");
if (existsSync(envPath)) dotenv.config({ path: envPath });
else if (existsSync(parentEnvPath)) dotenv.config({ path: parentEnvPath });

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [k, ...vParts] = trimmed.split("=");
      const v = vParts.join("=").trim().replace(/^["']|["']$/g, "");
      out[k!.trim()] = v;
    }
  } catch {
    // ignore
  }
  return out;
}

export function loadEnv(): Record<string, string> {
  const localPath = join(ROOT, ".env");
  const parentPath = join(ROOT, "..", ".env");
  const out: Record<string, string> = {};
  if (basename(ROOT) === "polymarket-arbitrage-node") Object.assign(out, parseEnvFile(parentPath));
  Object.assign(out, parseEnvFile(localPath));
  Object.assign(out, process.env as Record<string, string>);
  return out;
}

export function loadYaml(name: string): Record<string, unknown> {
  if (IS_VERCEL && name === "risk_params" && process.env.RISK_PARAMS_JSON) {
    try {
      return JSON.parse(process.env.RISK_PARAMS_JSON) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const path = join(CONFIG_DIR, `${name}.yaml`);
  if (!existsSync(path)) return {};
  try {
    const content = readFileSync(path, "utf-8");
    const data = yaml.load(content);
    return (data as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

export function saveRiskParams(data: Record<string, unknown>): void {
  if (IS_VERCEL) {
    throw new Error(
      "Vercel'de config dosyaya yazılamaz. Risk params için Vercel Dashboard > Environment Variables'da RISK_PARAMS_JSON ekleyin (JSON string)."
    );
  }
  const p = join(CONFIG_DIR, "risk_params.yaml");
  const content = yaml.dump(data, { lineWidth: -1, noRefs: true });
  writeFileSync(p, content, "utf-8");
}

export function saveMonitoringAlerts(data: Record<string, unknown>): void {
  if (IS_VERCEL) {
    throw new Error("Vercel'de config dosyaya yazılamaz. Monitoring alerts için env kullanın.");
  }
  const p = join(CONFIG_DIR, "monitoring.yaml");
  const cfg = existsSync(p) ? loadYaml("monitoring") : {};
  (cfg as Record<string, unknown>).alerts = { ...((cfg.alerts as object) ?? {}), ...data };
  const content = yaml.dump(cfg, { lineWidth: -1, noRefs: true });
  writeFileSync(p, content, "utf-8");
}
